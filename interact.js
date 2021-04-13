const Web3 = require('web3')
const ContractKit = require('@celo/contractkit')
const web3 = new Web3('https://alfajores-forno.celo-testnet.org')
const kit = ContractKit.newKitFromWeb3(web3)
const CeloCrowdfund = require('./build/contracts/CeloCrowdfund.json');
const Project = require('./build/contracts/Project.json')
const BigNumber = require('bignumber.js');

require('dotenv').config({path: '.env'});

// Get Celo account info 
const account = web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY);
kit.connection.addAccount(account.privateKey)

var projectInstanceContract; 
var stableToken;

async function payOut(stableToken) {
  var payOut = await projectInstanceContract.methods.payOut().send({from: account.address, feeCurrency: stableToken.address});
  console.log("Paying out from project");
}

async function printBalances(stableToken) {
  var balanceOfUser = (await stableToken.balanceOf(account.address)).toString();
  console.log("User's address: ", account.address);
  console.log("User's cUSD balance: ", balanceOfUser/1E18, " cUSD\n");

  var balanceOfContract = (await stableToken.balanceOf(projectInstanceContract._address)).toString();
  console.log("Contract address: ", projectInstanceContract._address);
  console.log("Contract cUSD balance: ", balanceOfContract/1E18, " cUSD\n");
}

async function createProject(celoCrowdfundContract, projectGoal, stableToken) {
  await celoCrowdfundContract.methods.startProject(stableToken.address, 'NODEJS SCRIPT', 'Alex is testing functions on nodejs rn', 'https://i.imgur.com/T9RAp1T.jpg', 5, projectGoal).send({from: account.address, feeCurrency: stableToken.address});
  return "Created new project"; 
}

async function contribute(stableToken) {
  var sendAmount = BigNumber(2E18); 

  // Call contribute() function with 2 cUSD
  await projectInstanceContract.methods.contribute(sendAmount).send({from: account.address, feeCurrency: stableToken.address});
  console.log("Contributed to the project\n");
}

const delay = ms => new Promise(res => setTimeout(res, ms));

async function initContract() {
  // Check the Celo network ID
  const networkId = await web3.eth.net.getId();

  // Get the contract associated with the current network
  const deployedNetwork = CeloCrowdfund.networks[networkId];

  // Create a new contract instance from the celo crowdfund contract
  let celoCrowdfundContract = new kit.web3.eth.Contract(
      CeloCrowdfund.abi,
      deployedNetwork && deployedNetwork.address
  );

  // Print wallet address so we can check it on the block explorer
  console.log("Account address: ", account.address);

  // Get the cUSD ContractKit wrapper 
  stableToken = await kit.contracts.getStableToken();

  var projectGoal = BigNumber(1E18);
  var projectReceipt = await createProject(celoCrowdfundContract, projectGoal, stableToken);
  console.log("Project created: ", projectReceipt);

  // Return projects inside the celo crowdfund contract
  var result = await celoCrowdfundContract.methods.returnProjects().call();
  console.log("List of addressses for the projects created:", result);

  // Loop through the existing projects and save the last created project instance
  for (const projectAddress of result) {  
    // Create a new project instance for each project
    projectInstanceContract = new web3.eth.Contract(
      Project.abi,
      deployedNetwork && projectAddress
    );
  }
  
  var projectGoal = BigNumber(5E18);
  var result = await stableToken.approve(projectInstanceContract._address, projectGoal).sendAndWaitForReceipt({from: account.address});
  
  console.log("Waiting 5s...")
  await delay(5000);
  console.log("Done waiting\n");

  await contribute(stableToken);

  await printBalances(stableToken); 

  console.log("Waiting 5s...")
  await delay(5000);
  console.log("Done waiting\n");

  await payOut(stableToken);
  console.log("After pay out: ");
  await printBalances(stableToken); 
}


initContract();