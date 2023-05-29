const { Telegraf } = require("telegraf");
const { message } = require("telegraf/filters");

const MESSAGE_LIFETIME_IN_MILLISECONDS = 30000;

function copyableText(str) {
	return `\`${str}\``;
}

module.exports = class TelegramBotManager extends ndapp.ApplicationComponent {
	async initialize() {
		await super.initialize();

		this.bot = new Telegraf(process.env.TELEGRAM_TOKEN);

		// this.bot.use((ctx, next) => {
		// 	app.log.info(app.tools.json.format(app.libs._.omit(ctx, "telegram")));

		// 	return next();
		// });

		const telegramUserId = parseFloat(process.env.TELEGRAM_USER_ID);
		this.bot.use((ctx, next) => {
			if (ctx.chat.id !== telegramUserId) throw new Error("Bad user");

			return next();
		});

		this.bot.command("refresh", async ctx => {
			await this.loadDB();

			this.autoDeleteMessage(ctx.message.chat.id, ctx.message["message_id"]);
		});

		this.bot.on(message("text"), async ctx => {
			let message = app.keePassDbManager.searchEntries(ctx.message.text).map(entry => {
				const title = entry.fields.get("Title");
				const username = entry.fields.get("UserName");
				const password = entry.fields.get("Password").getText();
				const notes = entry.fields.get("Notes");

				const lines = [title, copyableText(username), copyableText(password)];
				if (notes) lines.push("", copyableText(notes));

				return lines.join(app.os.EOL);
			}).join(app.os.EOL + app.os.EOL);

			if (!message) message = "Не найдено";

			const sendMessageResponse = await ctx.telegram.sendMessage(telegramUserId, message, {
				parse_mode: "Markdown"
			});

			this.autoDeleteMessage(ctx.message.chat.id, ctx.message["message_id"]);
			this.autoDeleteMessage(ctx.message.chat.id, sendMessageResponse["message_id"]);
		});

		this.bot.launch();
	}

	async autoDeleteMessage(chatId, messageId) {
		setTimeout(async () => {
			await this.bot.telegram.deleteMessage(chatId, messageId);
		}, MESSAGE_LIFETIME_IN_MILLISECONDS);
	}
};
