# TogetherWe

A framework-free, production-quality web game that runs directly from static files. It features two modes, "Laugh" and "Shake", designed as joyful micro-interactions to boost mood and raise awareness about mental well-being.

## Concept & Social-Impact Framing

TogetherWe is an experiment in using simple web technology to create positive experiences. The two game modes are grounded in evidence-based principles:

1.  **Laugh Mode:** Utilizes the microphone and on-device machine learning (MediaPipe YAMNet) to analyze and "score" laughter. This is based on research suggesting that laughter and humor interventions can reduce symptoms of anxiety and depression [7].
2.  **Shake Mode:** Uses the phone's motion sensors to score physical movement. This is inspired by large-scale studies confirming that brisk physical activity is an effective method for improving mood [5, 6].

The project aims to gently raise awareness about mental health burdens, particularly among youth in countries like **Vietnam** (where 1 in 5 adolescents reported a recent mental health problem, yet service access is low [1]) and **Australia** (where 1 in 5 people experienced a mental disorder in the past year [3]). The game is framed not as a solution, but as a small, accessible tool for a "micro-boost" to one's day.

## How to Run

Because this project is built entirely with static assets and has no build process, running it is simple:

1.  Clone or download the repository.
2.  Serve the project root directory from a local web server. A simple way to do this is with Python:
    ```bash
    # From the project's root directory:
    python3 -m http.server
    ```
3.  Open your browser and navigate to `http://localhost:8000`.

**Important:** The game's sensors (microphone and device motion) require a **secure context**. This means you must run the game via `https://` or `http://localhost`. Opening the `index.html` file directly from your filesystem (`file:///...`) will not work.

## Browser & Mobile Notes

*   **Supported Browsers:** Tested on modern Chrome (Desktop/Android) and Safari (iOS 16+).
*   **iOS Motion Permission:** On iOS devices, the browser will explicitly ask for permission to access Motion & Orientation data when you start "Shake" mode for the first time. You must grant this permission for the mode to work.
*   **Microphone Permission:** All browsers will prompt for microphone access when you start "Laugh" mode. The game cannot function without this permission.

## Privacy Disclaimer

**Your privacy is paramount.**
*   All audio and motion processing happens **entirely on your device** within the browser.
*   No audio, motion, or personal data is ever sent to a server.
*   Scores are saved **only in your browser's `localStorage`**. They are not shared with anyone and are private to the device and browser you are using.

## Testing Checklist

-   [x] **Chrome (Desktop):** Laugh mode works with mic. Shake mode shows a warning.
-   [x] **Safari (iOS 16+):** Laugh and Shake modes work. Motion permission prompt is handled correctly.
-   [x] **Chrome (Android):** Laugh and Shake modes work as expected.
-   [x] **HTTPS Requirement:** An alert/message correctly appears if not on `https://` or `localhost`.
-   [x] **YAMNet Model Fallback:** The laugh model correctly falls back to the Google Cloud Storage URL if the primary TF Hub URL fails.
-   [x] **Scoreboard Persistence:** Scores and player names persist across page reloads. Name input is validated.
-   [x] **Performance:** The main thread remains smooth during gameplay.

## Credits & References

This project uses the following open-source technologies:

*   **Tailwind CSS:** For utility-first styling, loaded via CDN.
*   **MediaPipe Tasks Audio (YAMNet):** For on-device audio classification, provided by Google.

### Academic & Data References

[1] Viet Nam Adolescent Mental Health Survey (V-NAMHS), 2023. qcmhr.org.  
[2] World Health Organization (WHO), "Mental health in Viet Nam".  
[3] Australian Institute of Health and Welfare (AIHW), "Mental health," updated May 20, 2025.  
[4] Australian Bureau of Statistics (ABS), "National Study of Mental Health and Wellbeing."  
[5] BMJ, "Exercise for depression: umbrella review and meta-analysis of 14,170 participants from 218 randomised controlled trials," 2024.  
[6] PubMed, "The effectiveness of physical activity and exercise for treating depression in adults: a meta-analysis of 127 randomized controlled trials," 2024.  
[7] PubMed, "The effect of laughter and humor interventions on depression, anxiety, and stress in adults: A meta-analysis," 2019.  
[8] Google AI for Developers, "MediaPipe Audio Classifier" & YAMNet documentation.
