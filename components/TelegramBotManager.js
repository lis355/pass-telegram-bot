const { Telegraf } = require("telegraf");
const { message } = require("telegraf/filters");

const MESSAGE_LIFETIME_IN_MILLISECONDS = 30000;

function copyableText(str) {
	return `\`${str}\``;
}

function isMeMiddleware(ctx, next) {
	if (ctx.chat.id !== Number(process.env.TELEGRAM_USER_ID)) throw new Error(`Bad user @${ctx.chat.username} (id=${ctx.chat.id})`);

	return next();
}

function commandMiddleware(ctx, next) {
	const parts = ctx.message.text.split(" ");

	ctx.state.command = {
		name: parts[0].substring(1),
		arguments: parts.slice(1)
	};

	return next();
}

module.exports = class TelegramBotManager extends ndapp.ApplicationComponent {
	async initialize() {
		await super.initialize();

		this.bot = new Telegraf(process.env.TELEGRAM_TOKEN);

		if (app.isDevelop) {
			this.bot.use((ctx, next) => {
				app.log.info(app.tools.json.format(app.libs._.omit(ctx, "telegram")));

				return next();
			});
		}

		this.bot
			.command("start",
				isMeMiddleware,
				async ctx => {
					await this.sendMessageWithAutoDelete(ctx.message.chat.id, "Hi!");
				})
			.command("refresh",
				isMeMiddleware,
				commandMiddleware,
				async ctx => {
					await app.keePassDbManager.loadDB();

					this.autoDeleteContextMessage(ctx);
					await this.sendMessageWithAutoDelete(ctx.message.chat.id, "DB reloaded");
				})
			.command("psw",
				commandMiddleware,
				async ctx => {
					const { username, password } = app.tools.generateUsernameAndPassword();

					const lines = [];
					lines.push(copyableText(username));
					lines.push(copyableText(password));

					const message = lines.join(app.os.EOL);

					this.autoDeleteContextMessage(ctx);
					await this.sendMessageWithAutoDelete(ctx.message.chat.id, message, {
						parse_mode: "Markdown"
					});
				})
			.on(message("text"),
				isMeMiddleware,
				async ctx => {
					let message = app.keePassDbManager.searchEntries(ctx.message.text).map(entry => {
						const title = `${entry.fields.get("Title")} (${entry.parentGroup.name})`;
						const username = entry.fields.get("UserName");
						const password = entry.fields.get("Password");
						const notes = entry.fields.get("Notes");

						const lines = [title];
						if (username) lines.push(copyableText(username));
						if (password) lines.push(copyableText(password.getText()));
						if (notes) lines.push(...notes.split(app.os.EOL).map(copyableText));

						return lines.join(app.os.EOL);
					}).join(app.os.EOL + app.os.EOL);

					if (!message) message = "Не найдено";

					this.autoDeleteContextMessage(ctx);
					await this.sendMessageWithAutoDelete(ctx.message.chat.id, message, {
						parse_mode: "Markdown"
					});
				})
			.catch((error, ctx) => {
				app.log.error(`Error for ${ctx.updateType}, ${error.message}, ${error.stack}`);
			})
			.launch();
	}

	async sendMessageWithAutoDelete(chatId, message, options) {
		const sendMessageResponse = await this.bot.telegram.sendMessage(chatId, message, options);

		await this.autoDeleteMessage(chatId, sendMessageResponse["message_id"]);
	}

	autoDeleteMessage(chatId, messageId) {
		setTimeout(async () => {
			await this.bot.telegram.deleteMessage(chatId, messageId);
		}, MESSAGE_LIFETIME_IN_MILLISECONDS);
	}

	autoDeleteContextMessage(ctx) {
		this.autoDeleteMessage(ctx.message.chat.id, ctx.message["message_id"]);
	}
};
