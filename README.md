# 🤖 AI-Powered Voice Waiter Robot

This project is a desktop application designed to act as an intelligent waiter robot. It utilizes **Speech Recognition** to listen to customer orders, processes natural language using a **Local LLM (via Ollama)** to extract structured data (items, quantities, table numbers), and manages orders using an **SQLite** database.

## 🚀 Features

* **🎙️ Voice-Activated:** Uses a microphone to capture real-time voice commands from users.
* **🧠 Local AI Processing:** Leverages local Large Language Models (like Llama 3 or Phi-3 running on Ollama) to understand context and intent without sending data to the cloud.
* **🗄️ Database Integration:** Automatically saves validated orders into an SQLite database for tracking.
* **🖥️ User Interface:** A graphical interface to view logs, active orders, and system status.
* **⚡ Offline Capable:** Since the LLM runs locally, the core intelligence works without an internet connection (once models are downloaded).

## 🛠️ Tech Stack

* **Programming Language:** Python 3.x
* **LLM Runtime:** [Ollama](https://ollama.com/)
* **Database:** SQLite
* **Libraries:**
    * `SpeechRecognition` (for voice capture)
    * `langchain` / `requests` (for communicating with Ollama)
    * `sqlite3` (standard library)
    * `PyQt5` / `Tkinter` (User Interface)

## ⚙️ Installation

Follow these steps to set up the project locally.

### 1. Prerequisites
* **Python 3.8+** installed.
* **Ollama** installed and running. [Download Ollama here](https://ollama.com/download).

### 2. Clone the Repository
```bash
git clone [https://github.com/genzo61/Senior_project.git](https://github.com/genzo61/Senior_project.git)
cd Garson Robot
