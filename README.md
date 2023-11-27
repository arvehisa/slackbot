# RAG Slackbot

## できること
- S3 バケットに PDF ファイルをいれると Embedding Lambda が発火されて、PDF を分割・Embedding して Postgres pgvector にいれる
- Slack で Bot をメンションしたら内容をベクトル検索して該当箇所をプロンプトに渡して LLM に回答させてスレッドで返信する


## 事前準備
- Slackbot を設定して下記を取得する
SLACK_BOT_TOKEN
SLACK_SIGNING_SECRET
SOCKET_MODE_TOKEN
- Secret Manager に `slackbot-credentials` という名前で手動で上記の Slack token を入れる


## CDK
- cdk deploy EcrStack
    App Runner 用の ECR を作成する

- App Runner 用のイメージを作られた ECR レポジトリにプッシュ
    このレポジトリでは Github Actions で 自動ビルドとプッシュを設定している

- cdk deploy CoreStack
    Network, RDS, S3, Lambda をデプロイ

- cdk deploy AppRunnerStack --no-rollback
    Slack App 用の App Runner と RDS 接続可能な pgadmin4 をデプロイ
    なぜか Slack App 用の App Runner は CDK でデプロイすると一回失敗するので、no-rollback 設定でコンソール上で Rebuild すると成功する