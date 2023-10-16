from slack_bolt import App

# Boltアプリの初期化
app = App(token="xoxb-827550038838-6030096452375-CZdfMVbnP5X6kVUHcYKDq9c1", signing_secret="0693df7ac78bab8738a635e936225b03")

# app_mention イベントのリッスン
@app.event("app_mention")
def mention(event, say):
    # メンションされた際の反応
    say("こんにちは")

# サーバーの起動
if __name__ == "__main__":
    app.start(port=3000)
