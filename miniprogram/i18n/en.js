module.exports = {
  "appTitle": "涨球",
  "lang": {
    "zh": "中文",
    "en": "EN"
  },
  "home": {
    "lead": "Film a swing, follow the shooting guide, then view the four-part result and practice cues.",
    "sub": "Use it to review your own practice. This does not promise a higher rating.",
    "devNote": "This is a development login. WeChat sign-in will be added later.",
    "login": "Development login",
    "loggingIn": "Signing in…",
    "continue": "View shooting guide",
    "codeLabel": "Login code (optional)",
    "codePlaceholder": "Leave blank to use a development code",
    "loggedIn": "Signed in",
    "localCode": "WeChat did not return a code, so a local development code was used.",
    "coachLibrary": "Stroke library / My demos"
  },
  "guide": {
    "title": "Shooting guide",
    "intro": "Check the items you already did. You can continue if some are open; the job will be marked guide not completed.",
    "incompleteHint": "An unfinished guide is stored on this job for a later result.",
    "progress": "Checked {{done}}/{{total}}",
    "continue": "Continue to upload",
    "items": [
      {
        "key": "side",
        "title": "Side-on camera",
        "desc": "Place the phone beside the player so the swing direction is visible. Do not film face-on."
      },
      {
        "key": "full_body",
        "title": "Full body in frame",
        "desc": "Keep the head, torso, and feet inside the frame."
      },
      {
        "key": "racket",
        "title": "Racket visible",
        "desc": "Keep the racket in frame through the backswing, contact, and follow-through."
      }
    ]
  },
  "upload": {
    "title": "Upload a swing",
    "intro": "Choose a video or record one. An 8–15 second swing is enough.",
    "guideDone": "Shooting guide completed",
    "guideSkipped": "Shooting guide not completed. The upload will still record that.",
    "strokeLabel": "This clip is mainly",
    "forehand": "Forehand",
    "backhand": "Backhand",
    "serve": "Serve",
    "choose": "Choose from album",
    "record": "Record now",
    "chosen": "Selected {{name}} ({{size}})",
    "none": "No video selected yet",
    "submit": "Upload and queue",
    "uploading": "Uploading…",
    "longClip": "This clip is long, so analysis will take longer after it is queued."
  },
  "queue": {
    "title": "Queued",
    "queued": "Queued",
    "running": "Analyzing",
    "done": "Analysis finished",
    "error": "Analysis did not finish",
    "cancelled": "This analysis was cancelled",
    "unknown": "Checking status",
    "jobId": "Job {{id}}",
    "polling": "Checking progress with the server.",
    "guideDone": "The shooting guide was completed for this job.",
    "guideSkipped": "The shooting guide was not completed. A later result can mark that.",
    "doneHint": "Analysis finished. You can open the four-part result and the practice cues.",
    "viewResult": "View four-part result",
    "home": "Back to home",
    "retry": "Upload again",
    "serverDetail": "Server note"
  },
  "errors": {
    "auth_required": "Sign in before uploading",
    "auth_invalid": "Your login expired. Sign in again",
    "login_code_invalid": "That login code is not valid. Try again",
    "login_body_invalid": "The login request could not be read",
    "guide_invalid": "The shooting guide could not be read",
    "guide_too_long": "The shooting guide data is too long",
    "bad_client": "This client could not be recognized",
    "video_required": "Choose or record a video first",
    "video_type": "Upload an mp4, mov, or webm video",
    "video_too_small": "The video file is too small or damaged",
    "video_too_large": "The video is over 400MB. Trim it and try again",
    "busy": "Another video is being analyzed. Try again shortly",
    "network": "Network problem. Check the connection and the server address",
    "bad_response": "Upload did not finish and no job id was returned",
    "server": "The server is busy. Try again shortly",
    "generic": "Something went wrong. Try again shortly",
    "i18n": "Could not load copy. Start the local server",
    "result_pending": "The result is still being prepared. Check again shortly",
    "result_missing": "This job could not be found",
    "result_unavailable": "This analysis did not finish"
  },
  "result": {
    "title": "Four-part result",
    "loading": "Loading this analysis…",
    "intro": "These four parts come from this analysis. Practice cues stay in Chinese. Camera angle can change the numbers.",
    "total": "Total {{score}} · {{grade}}",
    "noNumber": "—",
    "tipLabel": "Practice",
    "focusLabel": "Practice this first",
    "guideWarning": "The shooting guide was not completed, so the camera position may affect the numbers. Use this as practice feedback, not a precise measurement.",
    "serveNote": "You labeled this clip as a serve, so progress is tracked separately for serves. The numbers still come from the current swing analysis and are for practice.",
    "timelineTitle": "Progress timeline",
    "compareTitle": "Before and after",
    "compareNote": "This is the difference between an earlier and a later clip of the same stroke. It only shows that the two clips differ.",
    "earlier": "Earlier",
    "later": "Later",
    "delta": "Difference",
    "contactAt": "Contact around {{t}}s",
    "current": "This one",
    "backQueue": "Back to queue",
    "home": "Back to home",
    "axes": {
      "balance": "Balance",
      "contact": "Contact point",
      "chain": "Kinetic chain",
      "effect": "Ball effect"
    },
    "bands": {
      "high": "This part looks steady",
      "mid": "This part can use more practice",
      "low": "Practice this part first"
    },
    "grades": {
      "A": "Higher",
      "B": "Solid",
      "C": "Middle",
      "D": "Needs practice",
      "E": "Build the basics"
    },
    "strokes": {
      "forehand": "Forehand",
      "backhand": "Backhand",
      "serve": "Serve"
    },
    "reasons": {
      "need_two": "Comparison opens after 2 analyses of the same stroke. You have {{count}}.",
      "sign_in": "Sign in to see progress and comparison for your own strokes.",
      "not_owner": "Comparison is only for the signed-in account's own strokes.",
      "no_user": "This job is not tied to a signed-in user, so it cannot be saved on a progress timeline."
    }
  }
};
