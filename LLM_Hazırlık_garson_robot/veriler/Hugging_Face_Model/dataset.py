from datasets import load_dataset
import pandas as pd

# Dataset'i yükle
dataset = load_dataset("bitext/Bitext-restaurants-llm-chatbot-training-dataset")

# Sadece train split var
train_df = pd.DataFrame(dataset['train'])

# İlk birkaç satırı görüntüle
print(train_df.head())
