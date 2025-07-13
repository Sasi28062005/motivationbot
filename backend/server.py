from flask import Flask, request, jsonify # type: ignore
from transformers import pipeline # type: ignore

app = Flask(__name__)

# Load the chatbot model
chatbot = pipeline("text-generation", model="gpt2")

@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    user_input = data.get("message", "")
    
    # Generate response
    response = chatbot(user_input, max_length=50, temperature=0.7, top_k=50, top_p=0.9)
    
    return jsonify({"response": response[0]['generated_text']})

if __name__ == "__main__":
    app.run(debug=True)
