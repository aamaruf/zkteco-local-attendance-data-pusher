const net = require('net');
const axios = require('axios');

// Cloud API details
// const CLOUD_API_URL = 'https://api-staging.easterncorporation.net/api/v1/attendances/from-biometric-device';
const CLOUD_API_URL = 'http://localhost:4001/api/v1/attendances/from-biometric-device';
const LOCAL_TCP_PORT = 5002; // Default ZKT port


// Create a TCP server
const server = net.createServer((socket) => {
    console.log(`Device connected: ${socket.remoteAddress}:${socket.remotePort}`);

    socket.on('data', async (data) => {
        try {
            const rawData = data.toString();
            console.log('Raw Data Received:', rawData);

            // Handle HTTP-like requests (e.g., GET /iclock/cdata)
            if (rawData.startsWith("GET")) {
                console.log("Received HTTP request-like data, processing...");

                // Extract SN and other parameters from the URL (query string)
                const urlParams = new URLSearchParams(rawData.split(' ')[1].split('?')[1]);
                const deviceSerialNumber = urlParams.get('SN');
                const options = urlParams.get('options');
                const language = urlParams.get('language');
                const pushVersion = urlParams.get('pushver');

                console.log(`Device Serial Number: ${deviceSerialNumber}`);
                console.log(`Options: ${options}, Language: ${language}, Push Version: ${pushVersion}`);

                // Acknowledge the request from the device
                socket.write("HTTP/1.1 200 OK\n");
                socket.write("Content-Type: text/plain\n");
                socket.write("\n");
                socket.write("Data acknowledged.\n");
                socket.end();

                // Now, handle the attendance data (you might need to request data from the device via an additional API call or adjust based on the device's response format)

                // Assuming the attendance data can be retrieved from somewhere or is sent afterward
                const attendanceData = {
                    deviceSerialNumber: deviceSerialNumber,
                    timestamp: new Date().toISOString(),
                    employeeCode: "202501201",  // Replace with actual employee code from the device data
                    verifyMode: "Fingerprint",  // Replace with actual verify mode
                };
                console.log("🚀 ~ socket.on ~ attendanceData:", attendanceData)

                // Generate a validation token
                // const validationToken = generateValidationToken(attendanceData.employeeCode + attendanceData.timestamp);

                // Forward to cloud API
                const response = await axios.post(CLOUD_API_URL, {
                    ...attendanceData,
                    // validationToken,
                });

                console.log('Data sent to cloud:', response.status);
            }
        } catch (error) {
            console.error('Error processing data:', error.message);
            console.error('Raw data that caused the error:', data.toString());
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
