// Generated from skills/removid/styles/emotions.json by `project.mjs scaffold`. Do not edit: change the table, then scaffold again.
// Used by the emotion sheet (`npm run character -- <id> --emotions`); a real video reads its segments from plan.json.
export const EMOTION_DEFAULT = "neutral";
export const EMOTION_TRANSITION_SEC = 0.35;
export const EMOTION_TABLE = {
  "neutral": {
    "energy": 0.4,
    "face": {
      "smile": 0.45,
      "brow": 0,
      "raise": 0,
      "eye": 1,
      "tilt": 0
    },
    "body": {
      "bounce": 1
    },
    "gestures": [
      "wave",
      "point",
      "present"
    ]
  },
  "warm": {
    "energy": 0.5,
    "face": {
      "smile": 0.9,
      "brow": -0.1,
      "raise": 0.1,
      "eye": 1.05,
      "tilt": 0.03
    },
    "body": {
      "bounce": 1
    },
    "gestures": [
      "wave",
      "present"
    ]
  },
  "curious": {
    "energy": 0.55,
    "face": {
      "smile": 0.4,
      "brow": -0.15,
      "raise": 0.6,
      "eye": 1.12,
      "tilt": 0.08
    },
    "body": {
      "bounce": 0.9
    },
    "gestures": [
      "point",
      "present"
    ]
  },
  "confused": {
    "energy": 0.35,
    "face": {
      "smile": 0,
      "brow": -0.5,
      "raise": 0.3,
      "eye": 1,
      "tilt": 0.12
    },
    "body": {
      "bounce": 0.6
    },
    "gestures": [
      "present"
    ]
  },
  "surprised": {
    "energy": 0.8,
    "face": {
      "smile": 0.3,
      "brow": -0.2,
      "raise": 1,
      "eye": 1.3,
      "tilt": 0
    },
    "body": {
      "bounce": 1.3
    },
    "gestures": [
      "point",
      "present"
    ]
  },
  "excited": {
    "energy": 1,
    "face": {
      "smile": 1,
      "brow": -0.1,
      "raise": 0.5,
      "eye": 1.15,
      "tilt": 0.04
    },
    "body": {
      "bounce": 1.5
    },
    "gestures": [
      "wave",
      "point",
      "present"
    ]
  },
  "laugh": {
    "energy": 0.9,
    "face": {
      "smile": 1,
      "brow": -0.2,
      "raise": 0.3,
      "eye": 0.8,
      "tilt": 0.06
    },
    "body": {
      "bounce": 1.4
    },
    "gestures": [
      "wave",
      "present"
    ]
  },
  "proud": {
    "energy": 0.6,
    "face": {
      "smile": 0.7,
      "brow": 0.05,
      "raise": 0.2,
      "eye": 1,
      "tilt": -0.04
    },
    "body": {
      "bounce": 0.9
    },
    "gestures": [
      "present",
      "point"
    ]
  },
  "serious": {
    "energy": 0.45,
    "face": {
      "smile": 0.1,
      "brow": 0.35,
      "raise": 0,
      "eye": 0.92,
      "tilt": 0
    },
    "body": {
      "bounce": 0.5
    },
    "gestures": [
      "point",
      "present"
    ]
  },
  "mad": {
    "energy": 0.9,
    "face": {
      "smile": -0.4,
      "brow": 1,
      "raise": 0,
      "eye": 0.9,
      "tilt": -0.03
    },
    "body": {
      "bounce": 1.1
    },
    "gestures": [
      "point"
    ]
  },
  "sad": {
    "energy": 0.15,
    "face": {
      "smile": -0.5,
      "brow": -0.9,
      "raise": 0,
      "eye": 0.85,
      "tilt": 0.1
    },
    "body": {
      "bounce": 0.25
    },
    "gestures": []
  },
  "calm": {
    "energy": 0.25,
    "face": {
      "smile": 0.6,
      "brow": 0,
      "raise": 0,
      "eye": 0.95,
      "tilt": 0
    },
    "body": {
      "bounce": 0.5
    },
    "gestures": [
      "present"
    ]
  },
  "impressed": {
    "energy": 0.65,
    "face": {
      "smile": 0.8,
      "brow": -0.1,
      "raise": 0.55,
      "eye": 1.15,
      "tilt": 0.02
    },
    "body": {
      "bounce": 1.1
    },
    "gestures": [
      "present",
      "point"
    ]
  },
  "concerned": {
    "energy": 0.3,
    "face": {
      "smile": -0.15,
      "brow": -0.6,
      "raise": 0.15,
      "eye": 1,
      "tilt": 0.08
    },
    "body": {
      "bounce": 0.5
    },
    "gestures": [
      "present"
    ]
  },
  "thoughtful": {
    "energy": 0.3,
    "face": {
      "smile": 0.25,
      "brow": -0.1,
      "raise": 0.2,
      "eye": 0.95,
      "tilt": 0.1
    },
    "body": {
      "bounce": 0.4
    },
    "gestures": [
      "present"
    ]
  }
} as const;
