const net = require('net');
const axios = require('axios');

// Cloud API details
const CLOUD_API_URL = 'http://localhost:4001/api/v1/attendances/from-biometric-device';
const LOCAL_TCP_PORT = 5002;


// Function to parse attendance data from raw logs
function parseAttendanceData(rawData) {
    // Common ZKT format: PIN=12345;VERIFYMODE=1;TIMESTAMP=2025-02-11 10:30:00;
    const regex = /PIN=(\d+);VERIFYMODE=(\d+);TIMESTAMP=([\d-]+\s[\d:]+)/;
    const match = rawData.match(regex);

    if (!match) return null;

    const [_, employeeCode, verifyModeCode, timestamp] = match;

    // Convert verify mode code to human-readable format
    const verifyModeMap = {
        "0": "Password",
        "1": "Fingerprint",
        "2": "Card",
        "3": "Face",
    };

    return {
        employeeCode,
        verifyMode: verifyModeMap[verifyModeCode] || "Unknown",
        timestamp,
    };
}

// Create a TCP server
const server = net.createServer((socket) => {
    console.log(`Device connected: ${socket.remoteAddress}:${socket.remotePort}`);

    socket.on('data', async (data) => {
        try {
            const rawData = data.toString();
            console.log('Raw Data Received:', rawData);

            // If it's an HTTP-like request (device syncing)
            if (rawData.startsWith("GET")) {
                console.log("Received HTTP request-like data, processing...");

                // Extract SN and other parameters from the URL
                const urlParams = new URLSearchParams(rawData.split(' ')[1].split('?')[1]);
                const deviceSerialNumber = urlParams.get('SN');
                const options = urlParams.get('options');
                const language = urlParams.get('language');
                const pushVersion = urlParams.get('pushver');

                console.log(`Device Serial Number: ${deviceSerialNumber}`);
                console.log(`Options: ${options}, Language: ${language}, Push Version: ${pushVersion}`);

                // Acknowledge the request
                socket.write("HTTP/1.1 200 OK\n");
                socket.write("Content-Type: text/plain\n");
                socket.write("\n");
                socket.write("Data acknowledged.\n");
                socket.end();
            } // Check if this is attendance data (contains PIN=)
            if (rawData.includes("PIN=")) {
                console.log("Processing attendance log...");

                const attendanceDetails = parseAttendanceData(rawData);
                if (!attendanceDetails) {
                    console.error("Failed to parse attendance data.");
                    return;
                }

                console.log("Parsed Attendance Data:", attendanceDetails);

                // Generate a validation token
                const validationToken = generateValidationToken(attendanceDetails.employeeCode + attendanceDetails.timestamp);

                // Forward to cloud API
                const response = await axios.post(CLOUD_API_URL, {
                    deviceSerialNumber: socket.remoteAddress, // Using device IP as serial (update if needed)
                    ...attendanceDetails,
                    validationToken,
                });

                console.log('Data sent to cloud:', response.status);

                // Acknowledge receipt
                socket.write("HTTP/1.1 200 OK\n");
                socket.write("Content-Type: text/plain\n");
                socket.write("\n");
                socket.write("Attendance data received.\n");
                socket.end();
            }  else {
                console.log("Unknown data format received.");
            }
        } catch (error) {
            console.error('Error processing data:', error.message);
        }
    });

    socket.on('close', () => {
        console.log('Device disconnected');
    });
});

// Start the TCP server
server.listen(LOCAL_TCP_PORT, '0.0.0.0', () => {
    console.log(`TCP Server listening on port ${LOCAL_TCP_PORT}`);
});
