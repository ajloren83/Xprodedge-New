// frameWorker.js - Web Worker for frame loading and blob management
self.addEventListener("message", async (e) => {
  if (e.data.type === "loadFrames") {
    const { frames } = e.data.payload;
    
    try {
      const blobs = await Promise.all(
        frames.map(async (framePath) => {
          const resp = await fetch(framePath);
          if (!resp.ok) {
            throw new Error(`Failed to load frame: ${framePath}`);
          }
          const blob = await resp.blob();
          return { blob, framePath };
        })
      );
      
      self.postMessage({ 
        type: "blobsLoaded", 
        payload: blobs 
      });
    } catch (error) {
      self.postMessage({ 
        type: "error", 
        payload: { error: error.message } 
      });
    }
  }
});
