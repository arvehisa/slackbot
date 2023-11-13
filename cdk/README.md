* `cdk deploy EcrStack`
-> push container to ecr

* `cdk deploy NetworkStack`
* `cdk deploy RdsStack`
-> ローカルで接続できるようにRDS Security Group に Inbound MyIP をいれる
-> DB 接続して、`CREATE EXTENSION vector;` で pgvector を作る
-> data/dataprep-pgvector.py でデータの前処理。テーブルを作ってベクトルデータを入れる
-> Secrets Manager に手動で Slack Token いれる

* `cdk deploy AppRunnerStack --no-rollback`