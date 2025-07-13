from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route("/api/message", methods=["POST"])
def chatbot():
    data = request.get_json()
    user_message = data.get("message", "")
    return jsonify({"reply": f"You said: {user_message}"})

if __name__ == "__main__":
    app.run(port=3001, debug=True)
