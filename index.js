require('dotenv').config();
const axios = require('axios');
const Api = require('./api'); // Adjust the path if needed

const AMBER_API_KEY = process.env.AMBER_API_KEY;
const AMBER_SITE_ID = process.env.AMBER_SITE_ID;
const NICEHASH_API_KEY = process.env.NICEHASH_API_KEY;
const NICEHASH_API_SECRET = process.env.NICEHASH_API_SECRET;
const NICEHASH_ORG_ID = process.env.NICEHASH_ORG_ID;
const NICEHASH_RIG_ID = process.env.NICEHASH_RIG_ID;

const ELECTRICITY_PRICE_THRESHOLD = parseFloat(process.env.PRICE_THRESHOLD); // in cents/kWh

// Initialize the NiceHash API client
const apiClient = new Api({
  apiHost: 'https://api2.nicehash.com',
  apiKey: NICEHASH_API_KEY,
  apiSecret: NICEHASH_API_SECRET,
  orgId: NICEHASH_ORG_ID,
});

var miningRigIsStarted = false;

// Function to get current electricity price from Amber Electric
async function getElectricityInfo() {
  try {
    const response = await axios.get(
      `https://api.amber.com.au/v1/sites/${AMBER_SITE_ID}/prices/current?next=0&previous=0&resolution=30`,
      {
        headers: { Authorization: `Bearer ${AMBER_API_KEY}` },
      }
    );
    const price = response.data[0].perKwh;
    const demandWindowActive = response.data[0].tariffInformation.demandWindow
    console.log(`Current electricity price:\t${price} cents/kWh`);
    console.log(`Demand window active:\t\t${demandWindowActive}`);
    if(!demandWindowActive && price <= ELECTRICITY_PRICE_THRESHOLD)
        return true;
    else
        return false;
  } catch (error) {
    console.error('Error fetching electricity price:', error.message);
    return null;
  }
}

// Function to start the mining rig using NiceHash API
async function startMiningRig() {
    if(!miningRigIsStarted) {
        try {
            await apiClient.getTime(); // Synchronize time with server
        
            const response = await apiClient.post('/main/api/v2/mining/rigs/status2', {
              body: {
                rigId: NICEHASH_RIG_ID,
                action: 'START',
              },
            });
            console.log('Mining rig started.', response);
            miningRigIsStarted = true;
          } catch (error) {
            console.error('Error starting mining rig:', error);
          }
    }
}

// Function to stop the mining rig using NiceHash API
async function stopMiningRig() {
    if(miningRigIsStarted) {
        try {
            await apiClient.getTime(); // Synchronize time with server

            const response = await apiClient.post('/main/api/v2/mining/rigs/status2', {
            body: {
                rigId: NICEHASH_RIG_ID,
                action: 'STOP',
            },
            });
            console.log('Mining rig stopped.', response);
            miningRigIsStarted = false;
        } catch (error) {
            console.error('Error stopping mining rig:', error);
        }
    }
}

// Main function to control the mining rig based on electricity price
async function controlMiningRig() {
    const shouldBeMining = await getElectricityInfo();
    console.log(`Should we be mining?:\t\t${shouldBeMining}`);
    console.log('---');
    if (shouldBeMining === null) return;
        
    if (shouldBeMining) {
        await startMiningRig();
    } else {
        await stopMiningRig();
    }
}

// Schedule the control function to run every 1 minute
setInterval(controlMiningRig, 1 * 60 * 1000);
// Run it immediately on startup
controlMiningRig();
