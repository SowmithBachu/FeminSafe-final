// Three.js Background Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('bg-canvas').appendChild(renderer.domElement);

// Create particles
const particlesGeometry = new THREE.BufferGeometry();
const particlesCount = 5000;
const posArray = new Float32Array(particlesCount * 3);

for(let i = 0; i < particlesCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 5;
}

particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

const particlesMaterial = new THREE.PointsMaterial({
    size: 0.005,
    color: 0xffffff,
    transparent: true,
    opacity: 0.8
});

const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particlesMesh);

camera.position.z = 3;

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    particlesMesh.rotation.y += 0.0005;
    particlesMesh.rotation.x += 0.0005;
    renderer.render(scene, camera);
}
animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Location zones definition
const zones = {
    washroom: { x: 0, y: 0, width: 200, height: 150 },
    library: { x: 200, y: 0, width: 200, height: 150 },
    playground: { x: 400, y: 0, width: 200, height: 150 }
};

// Location counters
const locationCounts = {
    washroom: 0,
    library: 0,
    playground: 0
};

// Alert levels
const alertLevels = {
    normal: { color: 'green-500', width: '25%', text: 'Normal' },
    moderate: { color: 'yellow-500', width: '50%', text: 'Moderate' },
    high: { color: 'orange-500', width: '75%', text: 'High' },
    critical: { color: 'red-500', width: '100%', text: 'Critical' }
};

// Face Detection Setup
let video = document.getElementById('video');
let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');
let startBtn = document.getElementById('startBtn');
let stopBtn = document.getElementById('stopBtn');
let alertBar = document.getElementById('alert-bar');
let alertStatus = document.getElementById('alert-status');

let stream = null;
let isDetecting = false;
let startTime = null;
let timerInterval = null;

// Load face detection model
Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('/static/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/static/models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('/static/models'),
    faceapi.nets.faceExpressionNet.loadFromUri('/static/models')
]).then(startVideo);

async function startVideo() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;
        
        video.addEventListener('play', () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            // Scale zones based on video dimensions
            scaleZones(video.videoWidth, video.videoHeight);
        });
    } catch (err) {
        console.error('Error accessing camera:', err);
        updateAlertLevel('critical', 'Camera Error');
    }
}

function scaleZones(width, height) {
    const scaleX = width / 800;  // Assuming original zone definitions are based on 800px width
    const scaleY = height / 600; // and 600px height
    
    for (let zone in zones) {
        zones[zone] = {
            x: zones[zone].x * scaleX,
            y: zones[zone].y * scaleY,
            width: zones[zone].width * scaleX,
            height: zones[zone].height * scaleY
        };
    }
}

function startDetection() {
    if (!stream) return;
    
    isDetecting = true;
    resetLocationCounts();
    startTime = Date.now();
    updateAlertLevel('normal');
    
    // Start face detection
    detectFaces();
}

function stopDetection() {
    isDetecting = false;
    updateAlertLevel('normal');
}

function resetLocationCounts() {
    for (let location in locationCounts) {
        locationCounts[location] = 0;
        document.getElementById(`${location}-count`).textContent = '0';
    }
}

function updateLocationCount(location, count) {
    locationCounts[location] = count;
    document.getElementById(`${location}-count`).textContent = count.toString();
}

function checkZone(face) {
    const centerX = face.x + face.width / 2;
    const centerY = face.y + face.height / 2;
    
    for (let zone in zones) {
        const z = zones[zone];
        if (centerX >= z.x && centerX <= z.x + z.width &&
            centerY >= z.y && centerY <= z.y + z.height) {
            return zone;
        }
    }
    return null;
}

function updateAlertLevel(level, customText = null) {
    const alert = alertLevels[level];
    alertBar.className = `flex flex-col justify-center bg-${alert.color} transition-all duration-500`;
    alertBar.style.width = alert.width;
    alertStatus.className = `text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-${alert.color.replace('500', '200')} bg-${alert.color}/20`;
    alertStatus.textContent = customText || alert.text;
}

async function detectFaces() {
    if (!isDetecting) return;
    
    const detections = await faceapi.detectAllFaces(video, 
        new faceapi.TinyFaceDetectorOptions());
    
    // Reset counts for this frame
    resetLocationCounts();
    
    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Process each detected face
    detections.forEach(detection => {
        const zone = checkZone(detection.box);
        if (zone) {
            locationCounts[zone]++;
            updateLocationCount(zone, locationCounts[zone]);
        }
        
        // Draw face rectangle
        ctx.strokeStyle = '#FF69B4'; // Pink color for FeminSafe
        ctx.lineWidth = 2;
        ctx.strokeRect(detection.box.x, detection.box.y, detection.box.width, detection.box.height);
        
        // Draw zone label if in a zone
        if (zone) {
            ctx.fillStyle = '#FF69B4';
            ctx.font = '16px Arial';
            ctx.fillText(zone.toUpperCase(), detection.box.x, detection.box.y - 5);
        }
    });
    
    // Update alert level based on detection counts
    updateAlertBasedOnCounts();
    
    // Continue detection
    requestAnimationFrame(detectFaces);
}

function updateAlertBasedOnCounts() {
    const totalDetections = Object.values(locationCounts).reduce((a, b) => a + b, 0);
    const washroomCount = locationCounts.washroom;
    
    if (washroomCount >= 3) {
        updateAlertLevel('critical');
    } else if (totalDetections >= 10) {
        updateAlertLevel('high');
    } else if (totalDetections >= 5) {
        updateAlertLevel('moderate');
    } else {
        updateAlertLevel('normal');
    }
}

// Event listeners
startBtn.addEventListener('click', startDetection);
stopBtn.addEventListener('click', stopDetection);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
}); 