from slack_bolt import App
import os

SLACK_BOT_TOKEN = os.environ['SLACK_BOT_TOKEN']
SLACK_SIGNING_SECRET = os.environ['SLACK_SIGNING_SECRET']

# Boltアプリの初期化
app = App(token=SLACK_BOT_TOKEN, signing_secret=SLACK_SIGNING_SECRET)

# app_mention イベントのリッスン
@app.event("app_mention")
def mention(event, say):
    # メンション時のメッセージテキストを取得
    received_text = event['text']
    
    # 受け取ったテキストを加工して返信
    response = f"入力テキスト: {received_text}"
    say(response)

# サーバーの起動
if __name__ == "__main__":
    app.start(port=3000)



