from flask import Flask, render_template, request, redirect, session, url_for, jsonify
from flask_socketio import SocketIO, emit, join_room
from flask_mysqldb import MySQL
from detection_engine import predict_aggression
import os

app = Flask(__name__)
app.secret_key = os.environ.get(
    "FLASK_SECRET_KEY",
    "development-secret-key"
)

socketio = SocketIO(
    app,
    async_mode='threading',
    cors_allowed_origins="*"
)

os.makedirs("logs", exist_ok=True)

# ------------------ In-memory tracking ------------------
# aggression_count = {}
online_users = set()

# NEW: map socket id to username
socket_users = {}

# ------------------ MySQL Config -----------------------
app.config['MYSQL_HOST'] = 'localhost'
app.config['MYSQL_PORT'] = 3306
app.config['MYSQL_USER'] = 'root'
app.config['MYSQL_PASSWORD'] = ''
app.config['MYSQL_DB'] = 'cyber_aggression'

mysql = MySQL(app)


# ------------------ START PAGE -------------------------
@app.route('/')
def start():
    return redirect(url_for('login'))


# ------------------ PREVENT AUTHENTICATED PAGE CACHING ------------------
@app.after_request
def prevent_back_cache(response):

    # Prevent the browser from showing cached logged-in pages after logout
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0, private"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"

    return response





# ------------------ USERS PAGE -------------------------
@app.route('/users')
def users_list():

    if 'user' not in session:
        return redirect(url_for('login'))

    return render_template("userslist.html")



# ------------------ CHAT PAGE --------------------------
@app.route('/chat/<receiver>')
def chat(receiver):

    if 'user' not in session:
        return redirect(url_for('login'))

    return render_template("index.html", receiver=receiver)







# ------------------ REGISTER ---------------------------
@app.route('/register', methods=['GET', 'POST'])
def register():

    error = None

    if request.method == 'POST':

        username = request.form['username'].strip()
        password = request.form['password']

        cur = mysql.connection.cursor()

        # Check whether username already exists
        cur.execute(
            "SELECT username FROM users WHERE username=%s",
            (username,)
        )

        existing_user = cur.fetchone()

        if existing_user:

            cur.close()

            error = (
                "Registration failed: This username already exists. "
                "Please choose a different username."
            )

            return render_template(
                "register.html",
                error=error
            )


        # Create new user
        cur.execute(
            "INSERT INTO users(username,password) VALUES(%s,%s)",
            (username, password)
        )

        mysql.connection.commit()
        cur.close()

        return redirect(url_for('login'))


    return render_template(
        "register.html",
        error=error
    )








# ------------------ LOGIN ------------------------------
@app.route('/login', methods=['GET', 'POST'])
def login():

    error = None

    if request.method == 'POST':

        username = request.form['username'].strip()
        password = request.form['password']

        cur = mysql.connection.cursor()

        cur.execute(
            "SELECT * FROM users WHERE username=%s AND password=%s",
            (username, password)
        )

        user = cur.fetchone()

        cur.close()


        if user:

            session['user'] = username

            return redirect(
                url_for('users_list')
            )


        else:

            error = (
                "Login failed: Invalid username or password. "
                "Please check your credentials and try again."
            )

            return render_template(
                "login.html",
                error=error
            )


    return render_template(
        "login.html",
        error=error
    )





# ------------------ LOGOUT -----------------------------
@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))





# ------------------ GET USERS LIST ---------------------
@app.route('/get_users')
def get_users():

    if 'user' not in session:
        return jsonify({
            "users": []
        }), 401

    current_user = session['user']

    cur = mysql.connection.cursor()

    try:

        # Get all users except current user
        cur.execute("""
            SELECT username
            FROM users
            WHERE username != %s
        """, (current_user,))

        rows = cur.fetchall()


        # Get accepted friends
        cur.execute("""
            SELECT
                CASE
                    WHEN sender = %s THEN receiver
                    ELSE sender
                END AS friend
            FROM friend_requests
            WHERE (sender = %s OR receiver = %s)
            AND status = 'accepted'
        """, (
            current_user,
            current_user,
            current_user
        ))

        friend_rows = cur.fetchall()


        friends = {
            row[0]
            for row in friend_rows
        }


        user_list = [
            row[0]
            for row in rows
            if row[0] not in friends
        ]


        return jsonify({
            "users": user_list
        })

    except Exception as e:

        print(
            "Get users error:",
            e
        )

        return jsonify({
            "users": [],
            "message": "Unable to load users."
        }), 500

    finally:

        cur.close()





# ---------------- SEND REQUEST ----------------
@app.route('/send_request', methods=['POST'])
def send_request():

    if 'user' not in session:
        return jsonify({
            "status": "unauthorized",
            "message": "Please login first."
        }), 401

    sender = session['user']

    receiver = request.form.get(
        'receiver',
        ''
    ).strip()

    if not receiver:
        return jsonify({
            "status": "invalid",
            "message": "Receiver username is required."
        }), 400

    if receiver == sender:
        return jsonify({
            "status": "invalid",
            "message": "You cannot send a request to yourself."
        }), 400

    cur = mysql.connection.cursor()

    # ⭐ prevent duplicate request
    cur.execute(
        "SELECT * FROM friend_requests WHERE sender=%s AND receiver=%s",
        (sender,receiver)
    )

    existing = cur.fetchone()

    if existing:
        cur.close()
        return jsonify({"status":"already_sent"})

    cur.execute(
        "INSERT INTO friend_requests(sender,receiver,status) VALUES(%s,%s,'pending')",
        (sender,receiver)
    )

    mysql.connection.commit()
    cur.close()

    socketio.emit("new_request",{
        "sender": sender,
        "receiver": receiver
    })

    return jsonify({"status":"request_sent"})








# ------------------ GET PENDING REQUESTS ----------------
@app.route('/get_requests')
def get_requests():

    if 'user' not in session:
        return jsonify({
            "status": "unauthorized",
            "requests": []
        }), 401

    user = session['user']
    cur = mysql.connection.cursor()

    cur.execute("""
        SELECT DISTINCT sender
        FROM friend_requests
        WHERE receiver=%s AND status='pending'
    """,(user,))

    requests = cur.fetchall()

    # get abusers
    cur.execute("SELECT username FROM abusers")
    abusers = [a[0] for a in cur.fetchall()]

    cur.close()

    data = []

    for r in requests:

        sender = r[0]

        data.append({
            "sender": sender,
            "is_abuser": sender in abusers
        })

    return jsonify({"requests":data})









# ---------------- GET SENT REQUESTS ----------------
@app.route('/get_sent_requests')
def get_sent_requests():

    if 'user' not in session:
        return jsonify({
            "status": "unauthorized",
            "requests": []
        }), 401

    sender = session['user']

    cur = mysql.connection.cursor()

    cur.execute("""
        SELECT receiver, MAX(status)
        FROM friend_requests
        WHERE sender=%s
        GROUP BY receiver
    """,(sender,))

    requests = cur.fetchall()
    cur.close()

    data = []

    for r in requests:
        data.append({
            "receiver": r[0],
            "status": r[1]
        })

    return jsonify({"requests":data})









# ---------------- GET FRIENDS ----------------
@app.route('/get_friends')
def get_friends():

    if 'user' not in session:
        return jsonify({"friends": []})

    username = session['user']

    cur = mysql.connection.cursor()

    cur.execute("""
        SELECT
            CASE
                WHEN sender = %s THEN receiver
                ELSE sender
            END AS friend
        FROM friend_requests
        WHERE (sender = %s OR receiver = %s)
        AND status = 'accepted'
    """, (username, username, username))

    rows = cur.fetchall()
    cur.close()

    friends = [row[0] for row in rows]

    return jsonify({"friends": friends})










# ---------------- REMOVE FRIEND ----------------
@app.route('/remove_friend', methods=['POST'])
def remove_friend():

    # Make sure user is logged in
    if 'user' not in session:
        return jsonify({
            "status": "unauthorized"
        }), 401

    current_user = session['user']

    friend = request.form.get(
        'friend',
        ''
    ).strip()

    if not friend:
        return jsonify({
            "status": "invalid",
            "message": "Friend username is required."
        }), 400

    # Prevent removing yourself
    if friend == current_user:
        return jsonify({
            "status": "invalid",
            "message": "You cannot remove yourself."
        }), 400

    cur = mysql.connection.cursor()

    try:

        # -------------------------------------------------
        # 1. CHECK WHETHER THEY ARE ACTUALLY FRIENDS
        # -------------------------------------------------

        cur.execute("""
            SELECT id
            FROM friend_requests
            WHERE
                (
                    sender = %s
                    AND receiver = %s
                )
                OR
                (
                    sender = %s
                    AND receiver = %s
                )
            AND status = 'accepted'
            LIMIT 1
        """, (
            current_user,
            friend,
            friend,
            current_user
        ))

        friendship = cur.fetchone()

        if not friendship:

            cur.close()

            return jsonify({
                "status": "not_friends",
                "message": "This user is not your friend."
            }), 400


        # -------------------------------------------------
        # 2. REMOVE THE FRIENDSHIP
        # -------------------------------------------------

        cur.execute("""
            DELETE FROM friend_requests
            WHERE
                (
                    sender = %s
                    AND receiver = %s
                )
                OR
                (
                    sender = %s
                    AND receiver = %s
                )
            AND status = 'accepted'
        """, (
            current_user,
            friend,
            friend,
            current_user
        ))


        # -------------------------------------------------
        # 3. DELETE ENTIRE CHAT HISTORY
        # -------------------------------------------------

        cur.execute("""
            DELETE FROM chat_messages
            WHERE
                (
                    sender = %s
                    AND receiver = %s
                )
                OR
                (
                    sender = %s
                    AND receiver = %s
                )
        """, (
            current_user,
            friend,
            friend,
            current_user
        ))


        # -------------------------------------------------
        # 4. DELETE READ STATUS FOR THIS CHAT
        # -------------------------------------------------

        cur.execute("""
            DELETE FROM chat_read_status
            WHERE
                (
                    username = %s
                    AND friend = %s
                )
                OR
                (
                    username = %s
                    AND friend = %s
                )
        """, (
            current_user,
            friend,
            friend,
            current_user
        ))


        # -------------------------------------------------
        # 5. SAVE ALL CHANGES
        # -------------------------------------------------

        mysql.connection.commit()

        cur.close()


        # -------------------------------------------------
        # 6. TELL FRONTEND REMOVAL WAS SUCCESSFUL
        # -------------------------------------------------

        return jsonify({
            "status": "removed",
            "friend": friend
        })


    except Exception as e:

        # Roll back if anything goes wrong
        mysql.connection.rollback()

        cur.close()

        print(
            "Remove friend error:",
            e
        )

        return jsonify({
            "status": "error",
            "message": "Unable to remove friend."
        }), 500










# ---------------- ACCEPT REQUEST ----------------
@app.route('/accept_request', methods=['POST'])
def accept_request():

    if 'user' not in session:
        return jsonify({
            "status": "unauthorized",
            "message": "Please login first."
        }), 401

    sender = request.form.get(
        'sender',
        ''
    ).strip()

    receiver = session['user']

    if not sender:
        return jsonify({
            "status": "invalid",
            "message": "Sender username is required."
        }), 400

    if sender == receiver:
        return jsonify({
            "status": "invalid",
            "message": "Invalid friend request."
        }), 400

    cur = mysql.connection.cursor()

    cur.execute(
        "UPDATE friend_requests SET status='accepted' WHERE sender=%s AND receiver=%s",
        (sender,receiver)
    )

    mysql.connection.commit()
    cur.close()

    socketio.emit("accepted_redirect",{
        "user": receiver
    })

    return jsonify({"status":"accepted"})











# ---------------- REJECT REQUEST ----------------
@app.route('/reject_request', methods=['POST'])
def reject_request():

    if 'user' not in session:
        return jsonify({
            "status": "unauthorized",
            "message": "Please login first."
        }), 401

    sender = request.form.get(
        'sender',
        ''
    ).strip()

    receiver = session['user']

    if not sender:
        return jsonify({
            "status": "invalid",
            "message": "Sender username is required."
        }), 400

    if sender == receiver:
        return jsonify({
            "status": "invalid",
            "message": "Invalid friend request."
        }), 400

    cur = mysql.connection.cursor()

    cur.execute(
        "UPDATE friend_requests SET status='rejected' WHERE sender=%s AND receiver=%s",
        (sender,receiver)
    )

    mysql.connection.commit()
    cur.close()

    return jsonify({"status":"rejected"})








# ------------------ ADMIN LOGIN ------------------
@app.route('/admin_login', methods=['GET', 'POST'])
def admin_login():

    if request.method == 'POST':

        username = request.form['username']
        password = request.form['password']

        cur = mysql.connection.cursor()

        cur.execute(
            "SELECT * FROM admins WHERE username=%s AND password=%s",
            (username, password)
        )

        admin = cur.fetchone()
        cur.close()

        if admin:
            session['admin'] = username
            return redirect(url_for('admin_dashboard'))
        else:
            return "Invalid Login"

    return render_template("admin_login.html")








# ------------------ ADMIN LOGOUT ------------------
@app.route('/admin_logout')
def admin_logout():

    session.pop('admin', None)

    return redirect(url_for('admin_login'))







# ------------------ ADMIN DASHBOARD ------------------
@app.route('/admin')
def admin_dashboard():

    if 'admin' not in session:
        return redirect(url_for('admin_login'))

    cur = mysql.connection.cursor()

    cur.execute("SELECT username, violations FROM abusers")
    abusers_data = cur.fetchall()

    cur.execute("SELECT username, message FROM blocked_messages")
    blocked_messages_data = cur.fetchall()

    cur.close()

    aggressive_users_db = {
        user: violations
        for user, violations in abusers_data
    }

    blocked_messages_db = [
        {"user": user, "message": msg}
        for user, msg in blocked_messages_data
    ]

    return render_template(
        "admin.html",
        aggressive_users=aggressive_users_db,
        blocked_messages=blocked_messages_db
    )







# ------------------ GET CHAT HISTORY ------------------
@app.route('/get_messages')
def get_messages():

    if 'user' not in session:
        return jsonify({"messages": []})

    current_user = session['user']
    receiver = request.args.get('receiver', '').strip()

    if not receiver:
        return jsonify({"messages": []})

    cur = mysql.connection.cursor()

    cur.execute("""
        SELECT id, sender, receiver, message, created_at
        FROM chat_messages
        WHERE (sender=%s AND receiver=%s)
           OR (sender=%s AND receiver=%s)
        ORDER BY id ASC
    """, (current_user, receiver, receiver, current_user))

    rows = cur.fetchall()
    cur.close()

    messages = []

    BLOCKED_CHAT_TEXT = "⚠ Message blocked due to policy"

    for message_id, sender, receiver_name, message, created_at in rows:

        message_type = (
            "blocked"
            if message == BLOCKED_CHAT_TEXT
            else "normal"
        )

        messages.append({
            "id": message_id,
            "sender": sender,
            "receiver": receiver_name,
            "message": message,
            "type": message_type,
            "created_at": created_at.strftime("%Y-%m-%d %H:%M:%S")
                if created_at else None
        })

    # Opening the chat marks messages received from this friend as read.
    cur = mysql.connection.cursor()

    cur.execute("""
        SELECT COALESCE(MAX(id), 0)
        FROM chat_messages
        WHERE sender=%s AND receiver=%s
    """, (receiver, current_user))

    latest_id = cur.fetchone()[0] or 0

    cur.execute("""
        INSERT INTO chat_read_status(username, friend, last_read_message_id)
        VALUES(%s, %s, %s)
        ON DUPLICATE KEY UPDATE last_read_message_id=%s
    """, (current_user, receiver, latest_id, latest_id))

    mysql.connection.commit()
    cur.close()

    return jsonify({"messages": messages})


# ------------------ GET UNREAD MESSAGE COUNTS ------------------
@app.route('/get_unread_counts')
def get_unread_counts():

    if 'user' not in session:
        return jsonify({"unread": {}})

    username = session['user']

    cur = mysql.connection.cursor()

    cur.execute("""
        SELECT
            cm.sender,
            COUNT(*) AS unread_count
        FROM chat_messages cm
        LEFT JOIN chat_read_status crs
            ON crs.username=%s
            AND crs.friend=cm.sender
        WHERE cm.receiver=%s
          AND cm.id > COALESCE(crs.last_read_message_id, 0)
        GROUP BY cm.sender
    """, (username, username))

    rows = cur.fetchall()
    cur.close()

    return jsonify({
        "unread": {
            sender: count
            for sender, count in rows
        }
    })


# ------------------ MARK MESSAGES AS READ ------------------
@app.route('/mark_messages_read', methods=['POST'])
def mark_messages_read():

    if 'user' not in session:
        return jsonify({"status": "unauthorized"}), 401

    username = session['user']
    friend = request.form.get('friend', '').strip()

    if not friend:
        return jsonify({"status": "invalid"}), 400

    cur = mysql.connection.cursor()

    cur.execute("""
        SELECT COALESCE(MAX(id), 0)
        FROM chat_messages
        WHERE sender=%s AND receiver=%s
    """, (friend, username))

    latest_id = cur.fetchone()[0] or 0

    cur.execute("""
        INSERT INTO chat_read_status(username, friend, last_read_message_id)
        VALUES(%s, %s, %s)
        ON DUPLICATE KEY UPDATE last_read_message_id=%s
    """, (username, friend, latest_id, latest_id))

    mysql.connection.commit()
    cur.close()

    return jsonify({"status": "read"})


# ------------------ PRIVATE CHAT ROOM ------------------
@socketio.on('join_private')
def join_private(data):

    if 'user' not in session:
        emit('receiver_offline', {
            "msg": "You are not logged in. Please login again."
        })
        return

    user1 = session['user']

    user2 = data.get('receiver', '').strip()

    if not user2:
        return

    if user1 == user2:
        return

    room = "_".join(
        sorted([user1, user2])
    )

    join_room(room)


#----Privete message ------------
@socketio.on('private_message')
def private_message(data):

    sender = socket_users.get(request.sid)

    if not sender:
        emit('receiver_offline', {
            "msg": "Your connection was lost. Please refresh the page."
        })
        return

    receiver = data.get('receiver', '').strip()
    message = data.get('message', '').strip()

    if not receiver:

        emit('receiver_offline', {
            "msg": "Invalid receiver."
        })

        return

    if not message:

        return
    
    if len(message) > 1000:

        emit('sender_warning', {
            "msg": "Message is too long. Maximum 1000 characters allowed."
        })

        return

    

    # Make sure the receiver exists
    cur = mysql.connection.cursor()
    cur.execute(
    "SELECT username FROM users WHERE username=%s",
    (receiver,)
    )
    receiver_exists = cur.fetchone()

    cur.close()
    if not receiver_exists:
        emit('receiver_offline', {
            "msg": "This user does not exist."
        })
        return







    # Receiver does not need to be online.
    # The message is stored and delivered in real time if possible.
    room = "_".join(sorted([sender, receiver]))












    # -------- AGGRESSION DETECTION --------
    result = predict_aggression(message)

    if result["blocked"]:

        # -------- SAVE BLOCKED MESSAGE FOR ADMIN --------
        cur = mysql.connection.cursor()

        cur.execute(
            "INSERT INTO blocked_messages(username, message) VALUES(%s, %s)",
            (sender, message)
        )

        mysql.connection.commit()
        cur.close()


        # -------- SAVE BLOCKED EVENT IN CHAT HISTORY --------
        #
        # Do NOT save the actual abusive text in chat_messages.
        # Save only the safe blocked-message placeholder so both
        # users can see it again after refresh/reopening the chat.
        blocked_chat_text = "⚠ Message blocked due to policy"

        cur = mysql.connection.cursor()

        cur.execute(
            """
            INSERT INTO chat_messages(sender, receiver, message)
            VALUES(%s, %s, %s)
            """,
            (sender, receiver, blocked_chat_text)
        )

        mysql.connection.commit()
        cur.close()

        # -------- PERSISTENT VIOLATION COUNT --------
        cur = mysql.connection.cursor()

        cur.execute(
            "SELECT violations FROM abusers WHERE username=%s",
            (sender,)
        )

        existing = cur.fetchone()

        if existing:
            # Increase existing violation count
            count = existing[0] + 1

            cur.execute(
                "UPDATE abusers SET violations=%s WHERE username=%s",
                (count, sender)
            )

        else:
            # First aggressive message
            count = 1

            cur.execute(
                "INSERT INTO abusers(username, violations) VALUES(%s, %s)",
                (sender, count)
            )

        mysql.connection.commit()
        cur.close()

        # -------- SEND WARNING --------
        if count < 3:
            warning_message = (
                f"⚠ Warning {count}/3: Aggressive message detected."
            )
        else:
            warning_message = (
                f"🚨 Aggressive message detected. "
                f"You have {count} total violations and have been flagged as an abuser."
            )

        emit('sender_warning', {
            "msg": warning_message
        })

        # -------- NOTIFY RECEIVER --------
        emit('receiver_alert', {
            "msg": "🚨 Aggressive message detected and blocked."
        }, room=room)

        # -------- SHOW BLOCKED MESSAGE --------
        emit('receive_message', {
            "user": "system",
            "message": "⚠ Message blocked due to policy",
            "type": "blocked"
        }, room=room)

    else:

        # -------- SAVE NORMAL PRIVATE MESSAGE --------
        cur = mysql.connection.cursor()

        cur.execute(
            """
            INSERT INTO chat_messages(sender, receiver, message)
            VALUES(%s, %s, %s)
            """,
            (sender, receiver, message)
        )

        mysql.connection.commit()
        cur.close()

        # -------- DELIVER IN REAL TIME IF RECEIVER IS ONLINE --------
        emit('receive_message', {
            "user": sender,
            "message": message,
            "type": "normal"
        }, room=room)

        # Refresh the receiver's unread badge immediately if they are online.
        for sid, connected_user in socket_users.items():
            if connected_user == receiver:
                socketio.emit(
                    'unread_update',
                    {"sender": sender},
                    to=sid
                )
# ------------------ ONLINE USERS -----------------------
# ------------------ ONLINE USERS -----------------------

@socketio.on('connect')
def connect():

    if 'user' in session:

        username = session['user']

        socket_users[request.sid] = username

        online_users.add(username)

        socketio.emit('update_users', list(online_users))


@socketio.on('disconnect')
def disconnect():

    sid = request.sid
    username = socket_users.pop(sid, None)

    if username:

        # Check whether this user still has another active socket
        user_still_connected = username in socket_users.values()

        if not user_still_connected:
            online_users.discard(username)

        socketio.emit('update_users', list(online_users))

# ------------------ RUN APP ----------------------------
if __name__ == "__main__":
    socketio.run(
        app,
        host="0.0.0.0",
        port=5000,
        debug=True
    )