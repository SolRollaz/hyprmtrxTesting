// api/tournament/checkClose.js

const { getTournamentById } = require('../db/tournamentModel');
const TimedClosure = require('./TimedClosure');
const AutoClosure = require('./AutoCloseOnSubmissions');
const TournamentLogger = require('./TournamentLogger');

/**
 * Checks if a tournament meets conditions for closure and triggers appropriate closure routine.
 * @param {string} tournamentId
 * @returns {Promise<boolean>} True if closure was triggered, false otherwise.
 */
async function shouldCloseTournament(tournamentId) {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) {
    TournamentLogger.warn(`Tournament ${tournamentId} not found.`);
    return false;
  }

  const now = Date.now();

  switch (tournament.closeType) {
    case 'timed': {
      const endTime = new Date(tournament.endTime).getTime();
      if (now >= endTime) {
        TournamentLogger.info(`Timed closure triggered for tournament ${tournamentId}`);
        await TimedClosure.close(tournament);
        return true;
      }
      break;
    }

    case 'auto': {
      if (tournament.submissionsCount >= tournament.maxSubmissions) {
        TournamentLogger.info(`Auto closure triggered for tournament ${tournamentId}`);
        await AutoClosure.close(tournament);
        return true;
      }
      break;
    }

    case 'manual': {
      TournamentLogger.info(`Manual closure type — no auto close for tournament ${tournamentId}`);
      break;
    }

    default: {
      TournamentLogger.error(`Unknown closeType '${tournament.closeType}' for tournament ${tournamentId}`);
      break;
    }
  }

  return false;
}

module.exports = { shouldCloseTournament };
