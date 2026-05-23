/**
 * Loads the YouTube IFrame Player API exactly once and resolves when the
 * global `YT` namespace is ready to use.
 */
let readyPromise: Promise<typeof YT> | null = null;

export function loadYouTubeApi(): Promise<typeof YT> {
  if (readyPromise) return readyPromise;

  readyPromise = new Promise<typeof YT>((resolve) => {
    if (typeof window.YT !== "undefined" && window.YT.Player) {
      resolve(window.YT);
      return;
    }

    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };

    if (!document.getElementById("youtube-iframe-api")) {
      const tag = document.createElement("script");
      tag.id = "youtube-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
  });

  return readyPromise;
}
