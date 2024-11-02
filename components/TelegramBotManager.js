import { EOL } from "node:os";

import _ from "lodash";
import { message } from "telegraf/filters";
import { Telegraf, Markup } from "telegraf";

import ApplicationComponent from "../app/ApplicationComponent.js";
import generateUsernameAndPassword from "../tools/generateUsernameAndPassword.js";

const MESSAGE_LIFETIME_IN_MILLISECONDS = 30000;
const MAX_SEARCH_ENTRIES_PRINT_COUNT = 3;
const MAX_SEARCH_ENTRIES_BUTTONS_COUNT = 10;

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

function copyableText(str) {
	return `\`${str}\``;
}

function formatEntryForCopy(entry) {
	const title = `${entry.fields.get("Title")} (${entry.parentGroup.name})`;
	const username = entry.fields.get("UserName");
	const password = entry.fields.get("Password");
	const notes = entry.fields.get("Notes");

	const lines = [title];
	if (username) lines.push(copyableText(username));
	if (password) lines.push(copyableText(password.getText()));
	if (notes) lines.push(...notes.split(EOL).map(copyableText));

	return lines.join(EOL);
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

					const telegramOptions = {
						parse_mode: "Markdown"
					};

					this.autoDeleteContextMessage(ctx);
					await this.sendMessageWithAutoDelete(ctx.message.chat.id, message, telegramOptions);
				})
			.action(/.+/, async ctx => {
				const entry = this.application.keePassDbManager.searchEntryByUuid(ctx.match.input);
				if (entry) {
					const message = formatEntryForCopy(entry);

					const telegramOptions = {
						parse_mode: "Markdown"
					};

					// this.autoDeleteChatMessage(ctx.callbackQuery.message.chat.id, ctx.callbackQuery.message["message_id"]);
					await this.sendMessageWithAutoDelete(ctx.callbackQuery.message.chat.id, message, telegramOptions);
				}
			})
			.on(message("text"),
				isMeMiddleware,
				async ctx => {
					let message = "";
					let telegramOptions = {};

					const searchEntriesResult = this.application.keePassDbManager.searchEntries(ctx.message.text);
					if (searchEntriesResult.entries.length === 0) {
						message = "Не найдено";
					} else if (searchEntriesResult.entries.length <= MAX_SEARCH_ENTRIES_PRINT_COUNT) {
						message = searchEntriesResult.entries
							.map(formatEntryForCopy)
							.join(EOL + EOL);

						telegramOptions = {
							parse_mode: "Markdown"
						};
					} else {
						message = `${ctx.message.text} [${searchEntriesResult.entries.length}]`;

						telegramOptions = Markup.inlineKeyboard(
							searchEntriesResult.entries
								.slice(0, MAX_SEARCH_ENTRIES_BUTTONS_COUNT)
								.map(entry => {
									const title = `${entry.fields.get("Title")} (${entry.parentGroup.name})`;

									return [
										Markup.button.callback(title, entry.uuid.valueOf())
									];
								})
						);
					}

					this.autoDeleteContextMessage(ctx);
					await this.sendMessageWithAutoDelete(ctx.message.chat.id, message, telegramOptions);
				})
			.catch((error, ctx) => {
				console.error(`Error for ${ctx.updateType}, ${error.message}, ${error.stack}`);
			})
			.launch({ dropPendingUpdates: !this.application.isDevelop });
	}

	async sendMessageWithAutoDelete(chatId, message, options) {
		const sendMessageResponse = await this.bot.telegram.sendMessage(chatId, message, options);

		await this.autoDeleteChatMessage(chatId, sendMessageResponse["message_id"]);
	}

	autoDeleteChatMessage(chatId, messageId) {
		setTimeout(async () => {
			await this.bot.telegram.deleteMessage(chatId, messageId);
		}, MESSAGE_LIFETIME_IN_MILLISECONDS);
	}

	autoDeleteContextMessage(ctx) {
		this.autoDeleteChatMessage(ctx.message.chat.id, ctx.message["message_id"]);
	}
}
