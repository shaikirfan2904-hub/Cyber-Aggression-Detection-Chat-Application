# Cyber Aggression Detection Chat Application

A real-time chat application that detects and blocks aggressive or abusive messages using Machine Learning.

## Features

- User Registration and Login
- Real-time private chat using Socket.IO
- Online and offline user detection
- Friend request system
- Accept and reject friend requests
- Friend list management
- Real-time message delivery
- Machine Learning based aggression detection
- Automatic blocking of aggressive messages
- Warning system for users sending abusive messages
- Persistent violation tracking
- Blocked message storage
- Admin login and dashboard
- View abusive users and their violation counts
- View blocked messages
- Responsive monochromatic user interface

## Technologies Used

### Frontend

- HTML5
- CSS3
- JavaScript

### Backend

- Python
- Flask
- Flask-SocketIO

### Database

- MySQL
- Flask-MySQLdb

### Machine Learning

- Scikit-learn
- Pickle
- TF-IDF Vectorizer
- Text Classification Model

## Project Structure

```text
Project_Software(Code_to_execute)
│
├── app.py
├── detection_engine.py
├── requirements.txt
├── README.md
├── .gitignore
│
├── model.pkl
├── vectorizer.pkl
│
├── datasets/
│   ├── cleaned_dataset.csv
│   └── merged_dataset.csv
│
├── logs/
│   ├── blocked_messages.log
│   └── user_activity.log
│
├── static/
│   ├── styles.css
│   ├── script.js
│   └── images/
│
├── templates/
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── userslist.html
│   ├── chat.html
│   ├── admin_login.html
│   └── admin.html
│
├── preprocess.py
├── merge_datasets.py
└── evaluate_model.py