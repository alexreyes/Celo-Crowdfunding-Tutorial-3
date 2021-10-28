const Web3 = require('web3');
const ContractKit = require('@celo/contractkit');
const web3 = new Web3('https://alfajores-forno.celo-testnet.org');
const kit = ContractKit.newKitFromWeb3(web3);
const CeloCrowdfund = require('./build/contracts/CeloCrowdfund.json');
const Project = require('./build/contracts/Project.json');
const BigNumber = require('bignumber.js');

require('dotenv').config({path: '.env'});

let account = web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY);
kit.connection.addAccount(account.privateKey)

async function createProject(celoCrowdfundContract, stableToken, gasPrice)  {
  var projectGoal = BigNumber(1E18);

  await celoCrowdfundContract.methods.startProject(stableToken.address, 'Test project', 'We are testing the create project function', 'https://i.imgur.com/Flfo4hJ.png',  5, projectGoal).send({from: account.address, feeCurrency: stableToken.address, gasPrice: gasPrice});
  
  console.log("Created a new project");
}

async function contribute(stableToken, projectInstanceContract, gasPrice)  {
  var sendAmount = BigNumber(2E18);

  // Contribute 2 cUSD to the project
  await projectInstanceContract.methods.contribute(sendAmount).send({from: account.address, feeCurrency: stableToken.address, gasPrice: gasPrice});

  console.log("Contributed to the newly created project\n");
}

async function printBalances(stableToken, projectInstanceContract)  {
  var balanceOfUser = (await stableToken.balanceOf(account.address)).toString();

  console.log("Personal wallet address: ", account.address);
  console.log("Personal wallet cUSD balance: ", balanceOfUser/1E18, " cUSD\n");

  var balanceOfContract = (await stableToken.balanceOf(projectInstanceContract._address)).toString();

  console.log("Contract address: ", projectInstanceContract._address);
  console.log("Contract cUSD balance: ", balanceOfContract/1E18,  " cUSD\n");
}

async function payOut(stableToken, projectInstanceContract, gasPrice)  {
  await projectInstanceContract.methods.payOut().send({from: account.address, feeCurrency: stableToken.address, gasPrice: gasPrice});
  console.log("Paying out the project's balance to the project's creator (personal wallet)");
}

async function interact()  {
  // Check the Celo network ID
  const networkId = await web3.eth.net.getId();

  // Get the contract associated with the current network
  const deployedNetwork = CeloCrowdfund.networks[networkId];

  // Create a new contract instance from the celo crowdfund contract
  let celoCrowdfundContract = new kit.web3.eth.Contract(CeloCrowdfund.abi, deployedNetwork && deployedNetwork.address);

  // Print wallet address so we can check it on the block explorer
  console.log("Account address: ", account.address);

  // Get the cUSD ContractKit wrapper
  var stableToken = await kit.contracts.getStableToken();

  // Get the gas price minimum and set the new gas price to be double
  const gasPriceMinimumContract = await kit.contracts.getGasPriceMinimum()
  const gasPriceMinimum = await gasPriceMinimumContract.getGasPriceMinimum(stableToken.address)
  const gasPrice = Math.ceil(gasPriceMinimum * 2) // This should be much higher than the current average, so the transaction will confirm faster

  await createProject(celoCrowdfundContract, stableToken, gasPrice);

  // Return projects inside the celo crowdfund contract
  var result = await celoCrowdfundContract.methods.returnProjects().call();
  console.log("List of addressses for each of the projects created:", result);
  
  var projectInstanceContract = new web3.eth.Contract(
    Project.abi,
    deployedNetwork && result[result.length - 1] // Get the most recently deployed Project
  );
  
  // Approve the project to spend up to 500 cUSD from the personal wallet
  var approveAmount = BigNumber(500E18); 
  await stableToken.approve(projectInstanceContract._address, approveAmount).sendAndWaitForReceipt({from: account.address, gasPrice: gasPrice});
  console.log('sent approve transaction');

  await contribute(stableToken, projectInstanceContract, gasPrice);
  
  await printBalances(stableToken, projectInstanceContract);

  await payOut(stableToken, projectInstanceContract, gasPrice);

  await printBalances(stableToken, projectInstanceContract);
}

interact();
