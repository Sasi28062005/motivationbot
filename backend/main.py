from transformers import pipeline # type: ignore

chatbot = pipeline("text-generation", model="gpt2")

response = chatbot("Hello, how are you?", 
                   max_length=50, 
                   temperature=0.7, 
                   top_k=50, 
                   top_p=0.9)

print(response[0]['generated_text'])
