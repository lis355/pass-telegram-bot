# pass-telegram-bot
Telegram bot with KeePass DB backend to store and access your passwords

## .env 
Options for using

`TELEGRAM_TOKEN=` your tg bot token

`TELEGRAM_USER_ID=` your tg id (only this user is allowed to communicate with bot)

`YANDEX_DISK_USE_REMOTE=` using remote or local Yandex Disk

`YANDEX_DISK_OAUTH_TOKEN=` if remote Yandex Disk, acess token. Can be generated there https://oauth.yandex.ru/

`YANDEX_DISK_KEEPASS_DB_FILE_PATH=` remote path to DB (example: `"/DB/DB.kdbx"`)
`YANDEX_DISK_KEEPASS_DB_KEY_FILE_PATH=` remote path to DB (example: `"/DB/KEY.key"`)

`YANDEX_DISK_LOCAL_KEEPASS_DB_FILE_PATH=` local path to DB (example: `"C:/YandexDisk/DB/DB.kdbx"`)
`YANDEX_DISK_LOCAL_KEEPASS_DB_KEY_FILE_PATH=` local path to master password (example: `"C:/YandexDisk/DB/DB.key"`)
