let socket = null;
let currentSender = null;


/* =========================================================
   PAGE INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    /* -----------------------------------------------------
       USER LIST PAGE
       These elements exist only on userlist.html
    ----------------------------------------------------- */

    if (document.getElementById("friends")) {

        loadFriends();
        loadUnreadCounts();
        loadUsers();
        loadRequests();
        loadSentRequests();

    }


    /* -----------------------------------------------------
       CHAT PAGE
       These elements exist only on chat.html
    ----------------------------------------------------- */

    if (typeof receiver !== "undefined") {

        const chatUser =
            document.getElementById("chatUser");

        if (chatUser) {

            chatUser.innerText =
                "Chat with " + receiver;

        }


        const messageInput =
            document.getElementById("messageInput");

        if (messageInput) {

            messageInput.addEventListener(
                "keydown",
                function (event) {

                    if (event.key === "Enter") {

                        event.preventDefault();

                        sendMessage();

                    }

                }
            );

        }

    }


    /* -----------------------------------------------------
       SOCKET CONNECTION
    ----------------------------------------------------- */

    try {

        socket = io();

        setupSocketEvents();

        setupChatEvents();

    }

    catch (error) {

        console.error(
            "Socket.IO connection failed:",
            error
        );

    }

});


/* =========================================================
   SECTION SWITCHING
========================================================= */

function showSection(sectionId, clickedButton) {

    const panels =
        document.querySelectorAll(".section-panel");

    const buttons =
        document.querySelectorAll(".section-btn");


    panels.forEach(function (panel) {

        panel.classList.remove("active");

    });


    buttons.forEach(function (button) {

        button.classList.remove("active");

    });


    const selectedPanel =
        document.getElementById(sectionId);


    if (selectedPanel) {

        selectedPanel.classList.add("active");

    }


    if (clickedButton) {

        clickedButton.classList.add("active");

    }


    if (sectionId === "friends-panel") {

        loadFriends();
        loadUnreadCounts();

    }

    else if (sectionId === "users-panel") {

        loadUsers();

    }

    else if (sectionId === "requests-panel") {

        loadRequests();

    }

    else if (sectionId === "sent-panel") {

        loadSentRequests();

    }

}


/* =========================================================
   FRIENDS
========================================================= */

function loadFriends() {

    fetch("/get_friends")

        .then(res => res.json())

        .then(data => {

            const div =
                document.getElementById("friends");


            if (!div) {

                return;

            }


            div.innerHTML = "";


            if (
                !data.friends ||
                data.friends.length === 0
            ) {

                div.innerHTML =
                    "<p class='empty-message'>No friends yet.</p>";

                return;

            }


            data.friends.forEach(function (friend) {

                const item =
                    document.createElement("div");


                item.className = "user";


                const encodedFriend =
                    encodeURIComponent(friend);


                item.innerHTML = `

                    <div class="friend-name-wrapper">

                        <span>
                            ${friend}
                        </span>

                        <span
                            class="unread-badge"
                            id="unread-${encodedFriend}"
                            style="display:none;">
                        </span>

                    </div>


                    <div class="friend-actions">

                        <button
                            type="button"
                            class="chat"
                            onclick="window.location='/chat/${encodedFriend}'">

                            Chat

                        </button>


                        <div class="friend-menu-wrapper">

                            <button
                                type="button"
                                class="friend-menu-button"
                                onclick="toggleFriendMenu(event, '${encodedFriend}')"
                                title="Friend options">

                                &#8942;

                            </button>


                            <div
                                class="friend-menu"
                                id="friend-menu-${encodedFriend}">

                                <button
                                    type="button"
                                    class="remove-friend-button"
                                    onclick="removeFriend('${encodedFriend}')">

                                    Remove Friend

                                </button>

                            </div>

                        </div>

                    </div>

                `;


                div.appendChild(item);

            });


            loadUnreadCounts();

        })

        .catch(function (error) {

            console.error(
                "Error loading friends:",
                error
            );

        });

}


/* =========================================================
   FRIEND MENU
========================================================= */

function toggleFriendMenu(event, friend) {

    event.stopPropagation();


    const menu =
        document.getElementById(
            "friend-menu-" + friend
        );


    if (!menu) {

        return;

    }


    document
        .querySelectorAll(".friend-menu")
        .forEach(function (otherMenu) {

            if (otherMenu !== menu) {

                otherMenu.classList.remove("show");

            }

        });


    menu.classList.toggle("show");

}


document.addEventListener("click", function () {

    document
        .querySelectorAll(".friend-menu")
        .forEach(function (menu) {

            menu.classList.remove("show");

        });

});


/* =========================================================
   REMOVE FRIEND
========================================================= */

function removeFriend(encodedFriend) {

    const friend =
        decodeURIComponent(encodedFriend);


    const menu =
        document.getElementById(
            "friend-menu-" + encodedFriend
        );


    if (menu) {

        menu.classList.remove("show");

    }


    const confirmed =
        confirm(
            "Remove " +
            friend +
            " from your friends?\n\n" +
            "This will permanently delete your " +
            "entire chat history with " +
            friend +
            "."
        );


    if (!confirmed) {

        return;

    }


    fetch(
        "/remove_friend",
        {

            method: "POST",

            headers: {
                "Content-Type":
                    "application/x-www-form-urlencoded"
            },

            body:
                "friend=" +
                encodeURIComponent(friend)

        }
    )

        .then(res => res.json())

        .then(data => {

            if (data.status === "removed") {

                loadFriends();
                loadUsers();
                loadUnreadCounts();


                alert(
                    friend +
                    " has been removed from your friends."
                );

            }

            else if (data.status === "not_friends") {

                alert(
                    "This user is no longer your friend."
                );

                loadFriends();
                loadUsers();

            }

            else {

                alert(
                    data.message ||
                    "Unable to remove friend."
                );

            }

        })

        .catch(function (error) {

            console.error(
                "Remove friend error:",
                error
            );


            alert(
                "An error occurred while removing the friend."
            );

        });

}


/* =========================================================
   UNREAD COUNTS
========================================================= */

function loadUnreadCounts() {

    fetch("/get_unread_counts")

        .then(res => res.json())

        .then(data => {

            document
                .querySelectorAll(".unread-badge")
                .forEach(function (badge) {

                    badge.style.display = "none";

                    badge.textContent = "";

                });


            if (!data.unread) {

                return;

            }


            Object.keys(data.unread)
                .forEach(function (friend) {

                    const badge =
                        document.getElementById(
                            "unread-" +
                            encodeURIComponent(friend)
                        );


                    if (!badge) {

                        return;

                    }


                    const count =
                        data.unread[friend];


                    if (count > 0) {

                        badge.textContent =
                            "  (+ " +
                            count +
                            " new)";

                        badge.style.display =
                            "inline-flex";

                    }

                });

        })

        .catch(function (error) {

            console.error(
                "Error loading unread counts:",
                error
            );

        });

}


/* =========================================================
   USERS
========================================================= */

function loadUsers() {

    fetch("/get_users")

        .then(res => res.json())

        .then(data => {

            const div =
                document.getElementById("users");


            if (!div) {

                return;

            }


            div.innerHTML = "";


            if (
                !data.users ||
                data.users.length === 0
            ) {

                div.innerHTML =
                    "<p class='empty-message'>No users available.</p>";

                return;

            }


            data.users.forEach(function (user) {

                const item =
                    document.createElement("div");


                item.className = "user";


                item.innerHTML = `

                    <span>
                        ${user}
                    </span>

                    <button
                        onclick="sendRequest('${user}')">

                        Send Request

                    </button>

                `;


                div.appendChild(item);

            });

        })

        .catch(function (error) {

            console.error(
                "Error loading users:",
                error
            );

        });

}


/* =========================================================
   SEND FRIEND REQUEST
========================================================= */

function sendRequest(user) {

    fetch(
        "/send_request",
        {

            method: "POST",

            headers: {
                "Content-Type":
                    "application/x-www-form-urlencoded"
            },

            body:
                "receiver=" +
                encodeURIComponent(user)

        }
    )

        .then(res => res.json())

        .then(data => {

            if (data.status === "already_sent") {

                alert("Request already sent");

            }

            else {

                alert("Request sent");

                loadUsers();
                loadSentRequests();

            }

        })

        .catch(function (error) {

            console.error(
                "Send request error:",
                error
            );

        });

}


/* =========================================================
   FRIEND REQUESTS
========================================================= */

function loadRequests() {

    fetch("/get_requests")

        .then(res => res.json())

        .then(data => {

            const div =
                document.getElementById("requests");


            if (!div) {

                return;

            }


            div.innerHTML = "";


            if (
                !data.requests ||
                data.requests.length === 0
            ) {

                div.innerHTML = `
                    <p class="empty-message">
                        No pending friend requests.
                    </p>
                `;

                return;

            }


            data.requests.forEach(function (req) {

                const sender =
                    req.sender;


                let abusiveBadge = "";


                if (req.is_abuser) {

                    abusiveBadge = `
                        <span class="abusive-badge">
                            ⚠ Abusive User
                        </span>
                    `;

                }


                const item =
                    document.createElement("div");


                item.className = "user";


                item.innerHTML = `

                    <div class="request-user-info">

                        <span class="username">
                            ${sender}
                        </span>

                        ${abusiveBadge}

                    </div>


                    <div class="request-actions">

                        <button
                            onclick="acceptRequest('${sender}', ${req.is_abuser})">

                            Accept

                        </button>


                        <button
                            class="reject"
                            onclick="rejectRequest('${sender}')">

                            Reject

                        </button>

                    </div>

                `;


                div.appendChild(item);

            });

        })

        .catch(function (error) {

            console.error(
                "Error loading friend requests:",
                error
            );

        });

}


/* =========================================================
   SENT REQUESTS
========================================================= */

function loadSentRequests() {

    fetch("/get_sent_requests")

        .then(res => res.json())

        .then(data => {

            const div =
                document.getElementById(
                    "sent_requests"
                );


            if (!div) {

                return;

            }


            div.innerHTML = "";


            if (
                !data.requests ||
                data.requests.length === 0
            ) {

                div.innerHTML =
                    "<p class='empty-message'>No sent requests.</p>";

                return;

            }


            data.requests.forEach(function (req) {

                const item =
                    document.createElement("div");


                item.className = "user";


                let button = "";


                if (req.status === "pending") {

                    button =
                        "<button disabled>Pending</button>";

                }

                else if (req.status === "accepted") {

                    button =
                        "<button class='accept' disabled>Accepted</button>";

                }

                else if (req.status === "rejected") {

                    button =
                        "<button class='reject' disabled>Rejected</button>";

                }


                item.innerHTML = `

                    <span>
                        ${req.receiver}
                    </span>

                    ${button}

                `;


                div.appendChild(item);

            });

        })

        .catch(function (error) {

            console.error(
                "Error loading sent requests:",
                error
            );

        });

}


/* =========================================================
   ACCEPT REQUEST
========================================================= */

function acceptRequest(sender, isAbuser) {

    if (isAbuser) {

        currentSender = sender;


        const dialog =
            document.getElementById(
                "warningDialog"
            );


        if (dialog) {

            dialog.style.display = "flex";

        }


        return;

    }


    fetch(
        "/accept_request",
        {

            method: "POST",

            headers: {
                "Content-Type":
                    "application/x-www-form-urlencoded"
            },

            body:
                "sender=" +
                encodeURIComponent(sender)

        }
    )

        .then(res => res.json())

        .then(function () {

            loadFriends();
            loadRequests();
            loadUsers();


            window.location =
                "/chat/" +
                encodeURIComponent(sender);

        })

        .catch(function (error) {

            console.error(
                "Accept request error:",
                error
            );

        });

}


/* =========================================================
   REJECT REQUEST
========================================================= */

function rejectRequest(sender) {

    fetch(
        "/reject_request",
        {

            method: "POST",

            headers: {
                "Content-Type":
                    "application/x-www-form-urlencoded"
            },

            body:
                "sender=" +
                encodeURIComponent(sender)

        }
    )

        .then(res => res.json())

        .then(function () {

            loadRequests();
            loadUsers();
            loadSentRequests();

        })

        .catch(function (error) {

            console.error(
                "Reject request error:",
                error
            );

        });

}


/* =========================================================
   CONFIRM ACCEPT
========================================================= */

function confirmAccept() {

    const dialog =
        document.getElementById(
            "warningDialog"
        );


    if (dialog) {

        dialog.style.display = "none";

    }


    fetch(
        "/accept_request",
        {

            method: "POST",

            headers: {
                "Content-Type":
                    "application/x-www-form-urlencoded"
            },

            body:
                "sender=" +
                encodeURIComponent(currentSender)

        }
    )

        .then(res => res.json())

        .then(function () {

            loadFriends();
            loadRequests();


            window.location =
                "/chat/" +
                encodeURIComponent(currentSender);

        })

        .catch(function (error) {

            console.error(
                "Confirm accept error:",
                error
            );

        });

}


/* =========================================================
   CLOSE WARNING DIALOG
========================================================= */

function closeDialog() {

    const dialog =
        document.getElementById(
            "warningDialog"
        );


    if (dialog) {

        dialog.style.display = "none";

    }

}


/* =========================================================
   SOCKET EVENTS — USER LIST
========================================================= */

function setupSocketEvents() {

    if (!socket) {

        return;

    }


    socket.on(
        "unread_update",
        function () {

            loadFriends();
            loadUnreadCounts();

        }
    );


    socket.on(
        "new_request",
        function () {

            loadRequests();

        }
    );


    socket.on(
        "accepted_redirect",
        function (data) {

            alert(
                data.user +
                " accepted your request"
            );


            loadFriends();
            loadUsers();
            loadSentRequests();


            window.location =
                "/chat/" +
                encodeURIComponent(data.user);

        }
    );

}


/* =========================================================
   SOCKET EVENTS — PRIVATE CHAT
========================================================= */

function setupChatEvents() {

    if (
        !socket ||
        typeof receiver === "undefined"
    ) {

        return;

    }


    socket.on(
        "connect",
        function () {

            socket.emit(
                "join_private",
                {
                    receiver: receiver
                }
            );
            loadChatHistory();
        }
    );






    function loadChatHistory() {

        fetch(
            "/get_messages?receiver=" +
            encodeURIComponent(receiver)
        )

            .then(res => res.json())

            .then(data => {

                const chatBox =
                    document.getElementById("chatBox");

                if (!chatBox) {
                    return;
                }

                chatBox.innerHTML = "";

                data.messages.forEach(function (msg) {

                    const div =
                        document.createElement("div");

                    if (msg.type === "blocked") {

                        div.classList.add(
                            "blocked-message"
                        );

                    }

                    else {

                        div.classList.add(
                            "message"
                        );

                        if (msg.sender === username) {

                            div.classList.add("sent");

                        }

                        else {

                            div.classList.add("received");

                        }

                    }

                    div.innerText =
                        msg.message;

                    chatBox.appendChild(div);

                });

                chatBox.scrollTop =
                    chatBox.scrollHeight;

            })

            .catch(function (error) {

                console.error(
                    "Error loading chat history:",
                    error
                );

            });

    }













    socket.on(
        "receive_message",
        function (data) {

            const chatBox =
                document.getElementById("chatBox");


            if (!chatBox) {

                return;

            }


            const div =
                document.createElement("div");


            if (data.type === "blocked") {

                div.classList.add(
                    "blocked-message"
                );

            }

            else {

                div.classList.add(
                    "message"
                );


                if (data.user === username) {

                    div.classList.add("sent");

                }

                else {

                    div.classList.add("received");

                }

            }


            div.innerText =
                data.message;


            chatBox.appendChild(div);


            chatBox.scrollTop =
                chatBox.scrollHeight;

        }
    );


    socket.on(
        "sender_warning",
        function (data) {

            showChatNotification(
                data && data.msg
                    ? data.msg
                    : "⚠ Aggressive message detected.",
                "warning"
            );

        }
    );


    socket.on(
        "receiver_alert",
        function (data) {

            showChatNotification(
                data && data.msg
                    ? data.msg
                    : "⚠ An aggressive message was detected.",
                "alert"
            );

        }
    );


    socket.on(
        "receiver_offline",
        function (data) {

            showChatNotification(
                data && data.msg
                    ? data.msg
                    : "The receiver is currently offline.",
                "alert"
            );

        }
    );

}


/* =========================================================
   SEND MESSAGE
========================================================= */

function sendMessage() {

    const input =
        document.getElementById(
            "messageInput"
        );


    if (!input) {

        return;

    }


    const message =
        input.value.trim();


    if (message === "") {

        return;

    }


    if (
        !socket ||
        !socket.connected
    ) {

        console.error(
            "Socket.IO is not connected."
        );


        alert(
            "Chat connection is not ready. Please refresh the page."
        );


        return;

    }


    socket.emit(
        "private_message",
        {
            receiver: receiver,
            message: message
        }
    );


    input.value = "";

    input.focus();

}


/* =========================================================
   CHAT NOTIFICATION
========================================================= */

function showChatNotification(
    message,
    type
) {

    let box =
        document.getElementById(
            "notificationBox"
        );


    if (!box) {

        box =
            document.createElement(
                "div"
            );


        box.id =
            "notificationBox";


        document.body.appendChild(
            box
        );

    }


    const notification =
        document.createElement(
            "div"
        );


    notification.classList.add(
        "notification"
    );


    if (type === "warning") {

        notification.classList.add(
            "warning"
        );

    }

    else if (type === "alert") {

        notification.classList.add(
            "alert"
        );

    }


    notification.textContent =
        message;


    box.appendChild(
        notification
    );


    setTimeout(
        function () {

            if (
                notification &&
                notification.parentNode
            ) {

                notification.remove();

            }

        },
        5000
    );

}