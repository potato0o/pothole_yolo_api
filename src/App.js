import React, { useState, useRef, useEffect } from 'react';
import { Client } from "@gradio/client";

const App = () => {
  // State to hold the single, persistent client instance
  const [client, setClient] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [detections, setDetections] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  // State for image dimensions
  const [originalImageDimensions, setOriginalImageDimensions] = useState(null);
  const [displayedImageDimensions, setDisplayedImageDimensions] = useState(null);


  const fileInputRef = useRef(null);
  const imageRef = useRef(null);

  // Effect to connect to the Gradio client once on component mount
  useEffect(() => {
    const connectClient = async () => {
      try {
        const app = await Client.connect("YeeZ1/yolo_detector");
        setClient(app);
      } catch (err) {
        console.error("Failed to connect to Gradio client:", err);
        setError("Failed to connect to the detection service. Please refresh the page.");
      }
    };

    connectClient();
  }, []);

  // Recalculate displayed dimensions on window resize
  useEffect(() => {
    const handleResize = () => {
      if (imageRef.current) {
        setDisplayedImageDimensions({
          width: imageRef.current.offsetWidth,
          height: imageRef.current.offsetHeight,
        });
      }
    };
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  // Function to handle image selection
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Reset state
    setDetections([]);
    setError(null);
    setOriginalImageDimensions(null);
    setDisplayedImageDimensions(null);
    
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  // Function to call the YOLO API
  const detectObjects = async () => {
    if (!imageFile || !client) {
      setError(!client ? 'Client not ready. Please wait.' : 'Please select an image first.');
      return;
    }

    setIsLoading(true);
    setDetections([]);
    setError(null);

    try {
      const result = await client.predict("/predict", { image: imageFile });
      const detectionData = result.data[0];
      setDetections(detectionData || []);
    } catch (err) {
      console.error(err);
      setError(`Failed to detect objects: ${err.message || "An unknown error occurred."}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Get image dimensions once it loads
  const onImageLoad = (e) => {
      setOriginalImageDimensions({
          width: e.target.naturalWidth,
          height: e.target.naturalHeight,
      });
      setDisplayedImageDimensions({
          width: e.target.offsetWidth,
          height: e.target.offsetHeight,
      });
  }

  // Calculate scaling factors
  const getScaleFactors = () => {
      if (!originalImageDimensions || !displayedImageDimensions) {
          return null;
      }
      return {
          scaleX: displayedImageDimensions.width / originalImageDimensions.width,
          scaleY: displayedImageDimensions.height / originalImageDimensions.height,
      };
  }

  const scaleFactors = getScaleFactors();

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-900 text-white p-4 font-sans">
      <h1 className="text-3xl md:text-4xl font-bold my-6">YOLO Object Detector</h1>

      {/* Image Display Area with Bounding Boxes */}
      <div className="w-full max-w-4xl min-h-96 bg-gray-800 rounded-xl flex justify-center items-center overflow-hidden relative shadow-lg">
        {isLoading && (
          <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col justify-center items-center z-30">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-lg">Detecting objects...</p>
          </div>
        )}
        
        {imagePreview ? (
          <div className="relative">
            <img
              ref={imageRef}
              src={imagePreview}
              className="block max-w-full h-auto max-h-[80vh]"
              alt="Selected for detection"
              onLoad={onImageLoad}
            />
            {/* Render Bounding Boxes */}
            {scaleFactors && detections.map((det, index) => {
                const { box, name, confidence } = det;
                const { scaleX, scaleY } = scaleFactors;

                const style = {
                    left: `${box.x1 * scaleX}px`,
                    top: `${box.y1 * scaleY}px`,
                    width: `${(box.x2 - box.x1) * scaleX}px`,
                    height: `${(box.y2 - box.y1) * scaleY}px`,
                    borderColor: '#10B981', // A nice green color
                    borderWidth: '2px',
                };

                return (
                    <div key={index} className="absolute border-2" style={style}>
                        <div className="bg-emerald-500 text-white text-xs font-bold px-1 py-0.5 absolute -top-4 left-0 rounded-sm w-fit whitespace-nowrap">
                            {name} ({(confidence * 100).toFixed(1)}%)
                        </div>
                    </div>
                );
            })}
          </div>
        ) : (
          <p className="text-gray-400">Select an image to begin</p>
        )}
      </div>

      {error && <p className="text-red-500 mt-4">{error}</p>}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        accept="image/*"
      />

      <div className="flex space-x-4 mt-6">
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105 shadow-md"
          onClick={() => fileInputRef.current.click()}
        >
          Select Image
        </button>
        <button
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105 shadow-md disabled:bg-gray-600 disabled:cursor-not-allowed disabled:transform-none"
          onClick={detectObjects}
          disabled={!imageFile || isLoading || !client}
        >
          {isLoading ? 'Detecting...' : 'Detect Objects'}
        </button>
      </div>

      {/* JSON Results Display */}
      {detections && detections.length > 0 && (
        <div className="w-full max-w-4xl mt-6">
          <h2 className="text-2xl font-bold mb-2">Detection Results (JSON)</h2>
          <pre className="bg-gray-800 text-green-300 p-4 rounded-lg overflow-x-auto text-sm">
            <code>
              {JSON.stringify(detections, null, 2)}
            </code>
          </pre>
        </div>
      )}
    </div>
  );
};

export default App;
