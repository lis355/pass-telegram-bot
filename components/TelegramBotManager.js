import { EOL } from "node:os";

import _ from "lodash";
import { message } from "telegraf/filters";
import { Telegraf } from "telegraf";

import ApplicationComponent from "../app/ApplicationComponent.js";
import generateUsernameAndPassword from "../tools/generateUsernameAndPassword.js";

const MESSAGE_LIFETIME_IN_MILLISECONDS = 30000;
const MAX_SEARCH_ENTRIES_COUNT = 3;

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

export default class TelegramBotManager extends ApplicationComponent {
	async initialize() {
		await super.initialize();

		this.bot = new Telegraf(process.env.TELEGRAM_TOKEN);

		if (this.application.isDevelop) {
			this.bot.use((ctx, next) => {
				console.log(_.omit(ctx, "telegram"));

				return next();
			});
		}

		this.bot
			.command("start",
				isMeMiddleware,
				async ctx => {
					await this.sendMessageWithAutoDelete(ctx.message.chat.id, "Hi!");
				})
			.command("stop",
				isMeMiddleware,
				async ctx => {
					this.application.quit(1);
				})
			.command("refresh",
				isMeMiddleware,
				commandMiddleware,
				async ctx => {
					await this.application.keePassDbManager.loadDB();

					this.autoDeleteContextMessage(ctx);
					await this.sendMessageWithAutoDelete(ctx.message.chat.id, "DB reloaded");
				})
			.command("psw",
				commandMiddleware,
				async ctx => {
					const { username, password } = generateUsernameAndPassword();

					const lines = [];
					lines.push(copyableText(username));
					lines.push(copyableText(password));

					const message = lines.join(EOL);

					this.autoDeleteContextMessage(ctx);
					await this.sendMessageWithAutoDelete(ctx.message.chat.id, message, {
						parse_mode: "Markdown"
					});
				})
			.on(message("text"),
				isMeMiddleware,
				async ctx => {
					let message;

					const searchEntriesResult = this.application.keePassDbManager.searchEntries(ctx.message.text);
					if (searchEntriesResult.entries.length === 0) {
						message = "Не найдено";
					} else if (searchEntriesResult.entries.length >= MAX_SEARCH_ENTRIES_COUNT) {
						message = searchEntriesResult.entries
							.slice(0, MAX_SEARCH_ENTRIES_COUNT)
							.map(entry => {
								const title = `${entry.fields.get("Title")} (${entry.parentGroup.name})`;

								const lines = [copyableText(title)];

								return lines.join(EOL);
							}).join(EOL);
					} else {
						message = searchEntriesResult.entries
							.map(entry => {
								const title = `${entry.fields.get("Title")} (${entry.parentGroup.name})`;
								const username = entry.fields.get("UserName");
								const password = entry.fields.get("Password");
								const notes = entry.fields.get("Notes");

								const lines = [title];
								if (username) lines.push(copyableText(username));
								if (password) lines.push(copyableText(password.getText()));
								if (notes) lines.push(...notes.split(EOL).map(copyableText));

								return lines.join(EOL);
							}).join(EOL + EOL);
					}

					this.autoDeleteContextMessage(ctx);
					await this.sendMessageWithAutoDelete(ctx.message.chat.id, message, {
						parse_mode: "Markdown"
					});
				})
			.catch((error, ctx) => {
				console.error(`Error for ${ctx.updateType}, ${error.message}, ${error.stack}`);
			})
			.launch({ dropPendingUpdates: !this.application.isDevelop });
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
}
