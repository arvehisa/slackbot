import os
import re

from slack_bolt import App
from slack_bolt.adapter.socket_mode import SocketModeHandler

from langchain.llms import Bedrock
# from langchain.prompts import PromptTemplate

# Slackbot
SLACK_BOT_TOKEN = os.environ['SLACK_BOT_TOKEN']
SOCKET_MODE_TOKEN = os.environ['SOCKET_MODE_TOKEN']
app = App(token=SLACK_BOT_TOKEN)

# llm
llm = Bedrock(
    model_id="anthropic.claude-v2",
)

#prompt = PromptTemplate(
#    input_variables = ["no_mention_text"]
#    template = f"""please answer step by step. {no_mention_text} Answer: """
#)

@app.event("app_mention")
def mention(event, say):
    #メンション部分を除去したメッセージテキスト
    no_mention_text = re.sub(r'^<.*>', '', event['text'])
    thread_ts = event['ts']

    template = f"""Question: please answer step by step. {no_mention_text} Answer: """
    response = llm(template)
    
    say(text=response, thread_ts=thread_ts)

# サーバーの起動
if __name__ == "__main__":
    handler = SocketModeHandler(app, SOCKET_MODE_TOKEN)
    handler.start()

