let socket = null;
let currentSender = null;


/* =========================================================
   INITIAL LOAD
========================================================= */

loadFriends();
loadUnreadCounts();
loadUsers();
loadRequests();
loadSentRequests();


/* =========================================================
   SECTION SWITCHING
========================================================= */

function showSection(sectionId, clickedButton) {

    const panels =
        document.querySelectorAll(".section-panel");

    const buttons =
        document.querySelectorAll(".section-btn");


    panels.forEach(panel => {

        panel.classList.remove("active");

    });


    buttons.forEach(button => {

        button.classList.remove("active");

    });


    document
        .getElementById(sectionId)
        .classList.add("active");


    clickedButton.classList.add("active");


    /*
     * Refresh the selected section.
     */

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
   SOCKET CONNECTION
========================================================= */

try {

    socket = io();

}

catch (error) {

    console.error(
        "Socket.IO connection failed:",
        error
    );

}





/* =========================================================
   FRIENDS
========================================================= */

function loadFriends() {

    fetch("/get_friends")

        .then(res => res.json())

        .then(data => {

            let div =
                document.getElementById(
                    "friends"
                );


            div.innerHTML = "";


            if (
                data.friends.length === 0
            ) {

                div.innerHTML =
                    "<p class='empty-message'>No friends yet.</p>";

                return;

            }


            data.friends.forEach(
                friend => {

                    let d =
                        document.createElement(
                            "div"
                        );


                    d.className =
                        "user";


                    d.innerHTML = `

                        <div class="friend-name-wrapper">

                            <span>
                                ${friend}
                            </span>

                            <span
                                class="unread-badge"
                                id="unread-${encodeURIComponent(friend)}"
                                style="display:none;">
                            </span>

                        </div>


                        <button
                            class="chat"
                            onclick="window.location='/chat/${friend}'">

                            Chat

                        </button>

                    `;


                    div.appendChild(d);

                }
            );


            loadUnreadCounts();

        });

}


/* =========================================================
   UNREAD MESSAGE COUNTS
========================================================= */

function loadUnreadCounts() {

    fetch("/get_unread_counts")

        .then(res => res.json())

        .then(data => {


            document
                .querySelectorAll(
                    ".unread-badge"
                )
                .forEach(
                    badge => {

                        badge.style.display =
                            "none";

                        badge.textContent =
                            "";

                    }
                );


            Object
                .keys(data.unread)
                .forEach(
                    friend => {


                        const badge =
                            document.getElementById(
                                "unread-" +
                                encodeURIComponent(
                                    friend
                                )
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

                    }
                );

        })

        .catch(error => {

            console.error(
                "Error loading unread message counts:",
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

            let div =
                document.getElementById(
                    "users"
                );


            div.innerHTML = "";


            if (
                data.users.length === 0
            ) {

                div.innerHTML =
                    "<p class='empty-message'>No users available.</p>";

                return;

            }


            data.users.forEach(
                user => {

                    let d =
                        document.createElement(
                            "div"
                        );


                    d.className =
                        "user";


                    d.innerHTML = `

                        <span>
                            ${user}
                        </span>


                        <button
                            onclick="sendRequest('${user}')">

                            Send Request

                        </button>

                    `;


                    div.appendChild(d);

                }
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
                encodeURIComponent(
                    user
                )

        }
    )

        .then(res => res.json())

        .then(data => {


            if (
                data.status === "already_sent"
            ) {

                alert(
                    "Request already sent"
                );

            }


            else {

                alert(
                    "Request sent"
                );


                loadUsers();

                loadSentRequests();

            }

        });

}


/* =========================================================
   FRIEND REQUESTS
========================================================= */

function loadRequests() {

    fetch("/get_requests")

        .then(res => res.json())

        .then(data => {

            let div =
                document.getElementById(
                    "requests"
                );


            div.innerHTML = "";


            /*
             * No pending requests.
             */

            if (
                data.requests.length === 0
            ) {

                div.innerHTML = `

                    <p class="empty-message">

                        No pending friend requests.

                    </p>

                `;



                return;

            }


            data.requests.forEach(
                req => {

                    let sender =
                        req.sender;


                    let abusiveBadge =
                        "";


                    /*
                     * Abusive user warning.
                     */

                    if (
                        req.is_abuser
                    ) {

                        abusiveBadge = `

                            <span
                                class="abusive-badge">

                                ⚠ Abusive User

                            </span>

                        `;

                    }


                    let d =
                        document.createElement(
                            "div"
                        );


                    d.className =
                        "user";


                    d.innerHTML = `

                        <div
                            class="request-user-info">

                            <span
                                class="username">

                                ${sender}

                            </span>

                            ${abusiveBadge}

                        </div>


                        <div
                            class="request-actions">


                            <button
                                onclick="acceptRequest(
                                    '${sender}',
                                    ${req.is_abuser}
                                )">

                                Accept

                            </button>


                            <button
                                class="reject"
                                onclick="rejectRequest(
                                    '${sender}'
                                )">

                                Reject

                            </button>


                        </div>

                    `;


                    div.appendChild(d);

                }
            );

        })

        .catch(error => {

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

            let div =
                document.getElementById(
                    "sent_requests"
                );


            div.innerHTML = "";


            if (
                data.requests.length === 0
            ) {

                div.innerHTML =
                    "<p class='empty-message'>No sent requests.</p>";

                return;

            }


            data.requests.forEach(
                req => {

                    let d =
                        document.createElement(
                            "div"
                        );


                    d.className =
                        "user";


                    let button =
                        "";


                    if (
                        req.status === "pending"
                    ) {

                        button =
                            "<button disabled>Pending</button>";

                    }


                    else if (
                        req.status === "accepted"
                    ) {

                        button =
                            "<button class='accept' disabled>Accepted</button>";

                    }


                    else if (
                        req.status === "rejected"
                    ) {

                        button =
                            "<button class='reject' disabled>Rejected</button>";

                    }


                    d.innerHTML = `

                        <span>

                            ${req.receiver}

                        </span>


                        ${button}

                    `;


                    div.appendChild(d);

                }
            );

        });

}


/* =========================================================
   ACCEPT REQUEST
========================================================= */

function acceptRequest(
    sender,
    isAbuser
) {


    /*
     * If sender is an abusive user,
     * show warning dialog first.
     */

    if (isAbuser) {

        currentSender =
            sender;


        document
            .getElementById(
                "warningDialog"
            )
            .style.display =
            "flex";


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
                encodeURIComponent(
                    sender
                )

        }
    )

        .then(res => res.json())

        .then(() => {


            loadFriends();

            loadRequests();

            loadUsers();


            window.location =
                "/chat/" +
                sender;

        });

}


/* =========================================================
   REJECT REQUEST
========================================================= */

function rejectRequest(
    sender
) {

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
                encodeURIComponent(
                    sender
                )

        }
    )

        .then(res => res.json())

        .then(() => {


            /*
             * Reload requests.
             */

            loadRequests();


            /*
             * Update users.
             */

            loadUsers();


            /*
             * Update sent requests.
             */

            loadSentRequests();


        });

}


/* =========================================================
   CONFIRM ACCEPT
========================================================= */

function confirmAccept() {


    document
        .getElementById(
            "warningDialog"
        )
        .style.display =
        "none";


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
                encodeURIComponent(
                    currentSender
                )

        }
    )

        .then(res => res.json())

        .then(() => {


            loadFriends();

            loadRequests();


            window.location =
                "/chat/" +
                currentSender;

        });

}


/* =========================================================
   CLOSE WARNING DIALOG
========================================================= */

function closeDialog() {

    document
        .getElementById(
            "warningDialog"
        )
        .style.display =
        "none";

}


/* =========================================================
   REAL-TIME EVENTS
========================================================= */

if (socket) {


    /*
     * New unread chat message.
     */

    socket.on(
        "unread_update",

        function () {

            loadFriends();

            loadUnreadCounts();

        }

    );


    /*
     * NEW FRIEND REQUEST
     *
     * This is the important part for
     * the notification badge.
     */

    socket.on(
        "new_request",

        function () {

            loadRequests();


        }

    );


    /*
     * Someone accepted our request.
     */

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
                data.user;

        }

    );

}







/* =========================================================
   PRIVATE CHAT
========================================================= */

if (typeof receiver !== "undefined") {

    /*
     * Join the private chat room.
     */
    function joinPrivateChat() {

        if (socket && socket.connected) {

            socket.emit("join_private", {
                receiver: receiver
            });

        }

    }


    /*
     * Socket connected.
     */
    if (socket) {

        socket.on("connect", function () {

            joinPrivateChat();

        });


        /*
         * Receive messages.
         */
        socket.on("receive_message", function (data) {

            const chatBox =
                document.getElementById("chatBox");

            if (!chatBox) {
                return;
            }


            const div =
                document.createElement("div");


            /*
             * Blocked message.
             */
            if (data.type === "blocked") {

                div.classList.add(
                    "blocked-message"
                );

            }


            /*
             * Normal message.
             */
            else {

                div.classList.add(
                    "message"
                );


                if (data.user === username) {

                    div.classList.add(
                        "sent"
                    );

                }

                else {

                    div.classList.add(
                        "received"
                    );

                }

            }


            div.innerText =
                data.message;


            chatBox.appendChild(div);


            chatBox.scrollTop =
                chatBox.scrollHeight;

        });

    }


    /*
     * SEND MESSAGE
     */
    function sendMessage() {

        const input =
            document.getElementById(
                "messageInput"
            );


        if (!input) {

            console.error(
                "messageInput not found."
            );

            return;

        }


        const message =
            input.value.trim();


        /*
         * Don't send empty messages.
         */
        if (message === "") {

            return;

        }


        /*
         * Make sure Socket.IO is connected.
         */
        if (!socket || !socket.connected) {

            console.error(
                "Socket.IO is not connected."
            );

            alert(
                "Chat connection is not ready. Please refresh the page."
            );

            return;

        }


        /*
         * Send message to Flask.
         */
        socket.emit(
            "private_message",
            {
                receiver: receiver,
                message: message
            }
        );


        /*
         * Clear input box.
         */
        input.value = "";


        /*
         * Put cursor back in the input.
         */
        input.focus();

    }


    /*
     * Sender warning.
     */
    if (socket) {

        socket.on(
            "sender_warning",
            function (data) {

                if (
                    typeof showNotification ===
                    "function"
                ) {

                    showNotification(
                        data.msg,
                        "warning"
                    );

                }

            }
        );


        /*
         * Receiver alert.
         */
        socket.on(
            "receiver_alert",
            function (data) {

                if (
                    typeof showNotification ===
                    "function"
                ) {

                    showNotification(
                        data.msg,
                        "alert"
                    );

                }

            }
        );


        /*
         * Connection lost.
         */
        socket.on(
            "receiver_offline",
            function (data) {

                if (
                    typeof showNotification ===
                    "function"
                ) {

                    showNotification(
                        data.msg,
                        "alert"
                    );

                }

            }
        );

    }

}