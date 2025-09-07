import { App, LogLevel } from '@slack/bolt';
import { envConfig } from './config/env';
import { filterTargetLanguages, formatTranslationResults } from './translator/translate';
import { langChainTranslationService } from './translator/langchain-service';
import { shouldProcessMessage, markMessageProcessed } from './middlewares/deduplication';
import { Logger, createTimer, recordTranslationSuccess, recordTranslationFailure } from './infra/metrics';
import { splitLongMessage } from './utils/text';

/**
 * Initialize Slack Bolt app with Socket Mode
 */
export const createSlackApp = (): App => {
  const app = new App({
    token: envConfig.slackBotToken,
    appToken: envConfig.slackAppToken,
    socketMode: true,
    logLevel: envConfig.logLevel === 'debug' ? LogLevel.DEBUG : LogLevel.INFO,
  });

  // Set up message event handler
  setupMessageHandler(app);
  
  // Set up mention handler (optional functionality)
  setupMentionHandler(app);

  // Set up error handlers
  setupErrorHandlers(app);

  Logger.info('Slack Bolt app initialized', {
    socketMode: true,
    threadMode: envConfig.threadMode,
    targetLangs: envConfig.targetLangs
  });

  return app;
};

/**
 * Set up message event handler for automatic translation
 */
const setupMessageHandler = (app: App): void => {
  app.message(async ({ message, say, client }) => {
    const timer = createTimer();
    
    try {
      // Cast message to access properties
      const msg = message as any;
      
      Logger.debug('Received message event', {
        channel: msg.channel,
        ts: msg.ts,
        user: msg.user,
        text: msg.text?.substring(0, 100) // Log first 100 chars only
      });

      // Check if message should be processed
      const processResult = shouldProcessMessage(msg);
      
      if (!processResult.shouldProcess) {
        Logger.debug('Skipping message', {
          reason: processResult.reason,
          channel: processResult.channelId,
          ts: processResult.messageTs
        });
        return;
      }

      // Mark as processed early to prevent race conditions
      markMessageProcessed(processResult.channelId, processResult.messageTs);

      // Get workspace info (temporarily skip team.info due to missing scope)
      // const teamInfo = await client.team.info();
      const workspaceId = 'temp-workspace-id';

      // Detect language using LangChain
      Logger.debug('Starting language detection', { text: msg.text?.substring(0, 50) });
      const sourceLang = await langChainTranslationService.detectLanguage(msg.text);
      
      if (sourceLang === 'und') {
        Logger.warn('Language detection failed or returned undefined', {
          channel: msg.channel,
          ts: msg.ts,
          text: msg.text?.substring(0, 100)
        });
        return;
      }

      Logger.info('Language detected', {
        channel: msg.channel,
        ts: msg.ts,
        detectedLang: sourceLang
      });

      // Filter target languages based on source language
      let targetLangs: string[] = [];
      if (sourceLang === 'ko') {
        targetLangs = ['en', 'ja'];
      } else if (sourceLang === 'ja') {
        targetLangs = ['ko', 'en'];
      } else {
        targetLangs = filterTargetLanguages(envConfig.targetLangs, sourceLang);
      }
      
      if (targetLangs.length === 0) {
        Logger.debug('No target languages after filtering', {
          sourceLang,
          originalTargets: envConfig.targetLangs
        });
        return;
      }

      // Translate to target languages
      Logger.debug('Starting translation', {
        sourceLang,
        targetLangs,
        targetCount: targetLangs.length
      });

      const translationResults = await langChainTranslationService.translateToMultiple(msg.text, targetLangs, sourceLang);

      // Format results for Slack
      const formattedMessage = formatTranslationResults(sourceLang, targetLangs, translationResults);
      
      // Split message if too long
      const messageParts = splitLongMessage(formattedMessage);

      // Post translation as thread reply
      const postOptions = envConfig.threadMode 
        ? { text: messageParts[0], thread_ts: msg.ts }
        : { text: messageParts[0] };

      await say(postOptions);

      // Post additional parts if message was split
      for (let i = 1; i < messageParts.length; i++) {
        const additionalOptions = envConfig.threadMode
          ? { text: messageParts[i], thread_ts: msg.ts }
          : { text: messageParts[i] };
        
        await say(additionalOptions);
      }

      // Record metrics
      const latencyMs = timer.stop();
      const successfulTranslations = translationResults.filter(r => r.success).length;
      const failedTranslations = translationResults.filter(r => !r.success).length;

      recordTranslationSuccess(
        workspaceId,
        msg.channel,
        msg.ts,
        sourceLang,
        targetLangs,
        latencyMs,
        successfulTranslations,
        failedTranslations
      );

      Logger.info('Translation completed', {
        channel: msg.channel,
        ts: msg.ts,
        sourceLang,
        targetLangs,
        successfulTranslations,
        failedTranslations,
        latencyMs,
        threadMode: envConfig.threadMode
      });

    } catch (error) {
      const latencyMs = timer.stop();
      const msg = message as any;
      
      Logger.error('Message processing failed', error as Error, {
        channel: msg.channel,
        ts: msg.ts,
        latencyMs
      });

      // Record failure metrics if we have enough context
      if (msg.channel && msg.ts) {
        try {
          const teamInfo = await client.team.info();
          const workspaceId = teamInfo.team?.id || 'unknown';
          
          recordTranslationFailure(
            workspaceId,
            msg.channel,
            msg.ts,
            'unknown',
            envConfig.targetLangs,
            latencyMs,
            'processing_error'
          );
        } catch (metricsError) {
          Logger.error('Failed to record failure metrics', metricsError as Error);
        }
      }
    }
  });
};

/**
 * Set up mention handler for targeted translation requests
 */
const setupMentionHandler = (app: App): void => {
  app.event('app_mention', async ({ event, say, client }) => {
    const timer = createTimer();
    
    try {
      Logger.debug('Received app mention', {
        channel: event.channel,
        ts: event.ts,
        user: event.user,
        text: event.text?.substring(0, 100)
      });

      // Parse mention for custom target languages
      // Format: @LingoCat -> en, fr
      const mentionMatch = event.text.match(/@\w+\s*->\s*([a-z,\s]+)/i);
      let targetLangs = envConfig.targetLangs;
      
      if (mentionMatch) {
        const customTargets = mentionMatch[1]
          .split(',')
          .map(lang => lang.trim())
          .filter(lang => lang.length === 2); // Basic validation for ISO-639-1
        
        if (customTargets.length > 0) {
          targetLangs = customTargets;
          Logger.info('Using custom target languages from mention', {
            customTargets,
            originalText: event.text
          });
        }
      }

      // Extract the actual text to translate (remove mention part)
      const textToTranslate = event.text.replace(/<@\w+>/, '').replace(/->\s*[a-z,\s]+/i, '').trim();
      
      if (!textToTranslate) {
        await say({
          text: "Please provide text to translate after mentioning me!",
          thread_ts: event.ts
        });
        return;
      }

      // Get workspace info (temporarily skip team.info due to missing scope)
      // const teamInfo = await client.team.info();
      const workspaceId = 'temp-workspace-id';

      // Detect and translate using LangChain
      const sourceLang = await langChainTranslationService.detectLanguage(textToTranslate);
      
      if (sourceLang === 'und') {
        await say({
          text: "Sorry, I couldn't detect the language of your text.",
          thread_ts: event.ts
        });
        return;
      }

      let filteredTargets: string[] = [];
      if (sourceLang === 'ko') {
        filteredTargets = ['en', 'ja'];
      } else if (sourceLang === 'ja') {
        filteredTargets = ['ko', 'en'];
      } else {
        filteredTargets = filterTargetLanguages(targetLangs, sourceLang);
      }
      
      if (filteredTargets.length === 0) {
        await say({
          text: `The detected language (${sourceLang}) is the same as all target languages.`,
          thread_ts: event.ts
        });
        return;
      }

      const translationResults = await langChainTranslationService.translateToMultiple(textToTranslate, filteredTargets, sourceLang);
      const formattedMessage = formatTranslationResults(sourceLang, filteredTargets, translationResults);
      
      const messageParts = splitLongMessage(formattedMessage);
      
      // Always reply in thread for mentions
      await say({ text: messageParts[0], thread_ts: event.ts });
      
      for (let i = 1; i < messageParts.length; i++) {
        await say({ text: messageParts[i], thread_ts: event.ts });
      }

      // Record metrics
      const latencyMs = timer.stop();
      const successfulTranslations = translationResults.filter(r => r.success).length;
      const failedTranslations = translationResults.filter(r => !r.success).length;

      recordTranslationSuccess(
        workspaceId,
        event.channel,
        event.ts,
        sourceLang,
        filteredTargets,
        latencyMs,
        successfulTranslations,
        failedTranslations
      );

      Logger.info('Mention translation completed', {
        channel: event.channel,
        ts: event.ts,
        sourceLang,
        targetLangs: filteredTargets,
        successfulTranslations,
        failedTranslations,
        latencyMs
      });

    } catch (error) {
      const latencyMs = timer.stop();
      
      Logger.error('Mention processing failed', error as Error, {
        channel: event.channel,
        ts: event.ts,
        latencyMs
      });

      try {
        await say({
          text: "Sorry, I encountered an error while processing your request. Please try again.",
          thread_ts: event.ts
        });
      } catch (replyError) {
        Logger.error('Failed to send error reply', replyError as Error);
      }
    }
  });
};

/**
 * Set up global error handlers
 */
const setupErrorHandlers = (app: App): void => {
  app.error(async (error: any) => {
    Logger.error('Slack app error', error as Error);
  });
};
