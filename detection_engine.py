import pickle
import re

# Load trained model
with open("model.pkl", "rb") as f:
    model = pickle.load(f)

with open("vectorizer.pkl", "rb") as f:
    vectorizer = pickle.load(f)


# Safe/common conversation phrases
SAFE_WORDS = [
    "hi",
    "hello",
    "hey",
    "hii",
    "hiii",
    "good morning",
    "good afternoon",
    "good evening",
    "good night",
    "how are you",
    "how are you man",
    "how are you bro",
    "how are you doing",
    "whats up",
    "what are you doing",
    "nice to meet you",
    "thank you",
    "thanks",
    "okay",
    "ok",
    "fine",
    "im fine",
    "i am fine",
    "bye",
    "see you",
    "how are u",
    "how r u",
    "hey are u there"
]


# Strong aggressive keywords
AGGRESSIVE_WORDS = [
    "idiot",
    "stupid",
    "loser",
    "dumb",
    "hate you",
    "kill yourself",
    "shut up",
    "shutup",
    "fucker",
    "bastard",
    "bitch",
    "cunt",
    "asshole",
    "motherfucker",
    "goddamn",
    "damn",
    "kill",
    "fuck",
    "go away",
    "leave me alone",
    "fuck off",
    "you are useless",
    "you are nothing",
    "you are a mistake",
    "you are a failure",
    "you are a disappointment",
    "you are a loser",
    "you are dumb",
    "you are stupid",
    "you are a fucker",
    "you are a bastard",
    "you are a bitch",
    "you are a cunt",
    "you are an asshole",
    "you are a motherfucker"
    "i hate you",

]


def clean_text(text):

    text = str(text).lower()

    text = re.sub(r"http\S+", "", text)
    text = re.sub(r"@\w+", "", text)
    text = re.sub(r"#\w+", "", text)
    text = re.sub(r"[^a-z\s]", "", text)

    return text


def predict_aggression(message):

    text = clean_text(message)

    # Empty message
    if not text.strip():
        return {
            "label": "SAFE",
            "blocked": False
        }

    # 1. Clearly aggressive words
    for word in AGGRESSIVE_WORDS:
        if word in text:
            return {
                "label": "AGGRESSIVE",
                "blocked": True
            }

    # 2. Common safe messages
    if text.strip() in SAFE_WORDS:
        return {
            "label": "SAFE",
            "blocked": False
        }

    # 3. Machine Learning prediction
    vec = vectorizer.transform([text])

    probability = model.predict_proba(vec)[0][1]

    # Higher threshold to reduce false positives
    if probability >= 0.95:
        return {
            "label": "AGGRESSIVE",
            "blocked": True
        }

    return {
        "label": "SAFE",
        "blocked": False
    }