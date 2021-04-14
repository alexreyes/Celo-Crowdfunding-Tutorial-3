# 3. Interacting with the Crowdfunding Smart Contracts


Welcome to the last tutorial in this three part series on creating a crowdfunding smart contract on Celo. In this last part we're going to write Javascript code in order to interact with the smart contract we wrote and deployed in the previous two parts.

Now that we have our smart contract on the Celo test network, it's time to use it!

# Prerequisites

You will need the smart contracts we wrote in part 1, and the deployments you made in part 2. Therefore, for the code in this tutorial to work you will need to have completed the prior two tutorials. 

# Setup 

The first step is to create a Javascript file to write our smart contract interactions in. In the root of your ``celo-crowdfunding`` folder, create a file named ``interact.js``.  

We will use the packages we installed via NPM in the first tutorial here. We will also need one additional module, BigNumber, in order to work with the large numbers the Celo blockchain uses. 

In your terminal, run: 

``npm install bignumber.js``

And that's it for our setup!

## Importing our modules

The first step for interacting with our smart contracts is importing the modules we'll need for our script. 

At the top of your ``interact.js`` file, write the following: 

```
const Web3 = require('web3');
const ContractKit = require('@celo/contractkit');
const web3 = new Web3('https://alfajores-forno.celo-testnet.org');
const kit = ContractKit.newKitFromWeb3(web3);
const CeloCrowdfund = require('./build/contracts/CeloCrowdfund.json');
const Project = require('./build/contracts/Project.json');
const BigNumber = require('bignumber.js');

require('dotenv').config({path:  '.env'});
```

We will use all of these modules later on in order to interact with the crowdfunding contracts we previously made. 

## Getting our contract	

The next thing we want to go is get our smart contract as a variable we can use. We'll also need to get our Celo account because we'll be sending transactions to the network. 

After the imports, write the following: 

```
// Get Celo account info

const account = web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY);
kit.connection.addAccount(account.privateKey)
```

The above code imports your private key from the ``.env`` file and puts it into the account variable. It also adds the Celo account to contractKit. 

Next, let's create an async function where we will write our interactions with the smart contract:  

```
async function interact()  {
  // Check the Celo network ID
  const networkId = await web3.eth.net.getId();

  // Get the contract associated with the current network
  const deployedNetwork = CeloCrowdfund.networks[networkId];

  // Create a new contract instance from the celo crowdfund contract
  let celoCrowdfundContract = new kit.web3.eth.Contract(CeloCrowdfund.abi, deployedNetwork && deployedNetwork.address);

  console.log("Account address: ", account.address);
  console.log(celoCrowdfundContract);
}

interact();
```

Let's run this. In your terminal, type: ``node interact.js``. You should get something like the following: 

![code](https://i.imgur.com/mtp0Dc3.png)

If all goes well, the output should show the account address, and the contract that we created. The contract output looks different than regular solidity code because it is a [contract ABI](https://docs.soliditylang.org/en/v0.5.3/abi-spec.html).

Great! So we've verified that the contract is getting imported correctly and our account works. 

Next, comment out the ``console.log`` of the ``celoCrowdfundContract`` variable since we won't use it anymore. 

The next step is to create a new ``Project``. Create a new function outside of ``interact()`` called ``createProject``: 

```
async function createProject(celoCrowdfundContract, stableToken)  {
  var projectGoal = BigNumber(1E18);
  await celoCrowdfundContract.methods.startProject(stableToken.address, 'Test project', 'We are testing the create project function', 'https://i.imgur.com/Flfo4hJ.png',  5, projectGoal).send({from: account.address, feeCurrency: stableToken.address});
  console.log("Created new project");
}
```

This function takes in the ``celoCrowdfunding`` contract, and a ``stableToken`` variable. It then creates a ``projectGoal`` using ``BigNumber``. 

We create a number that's of size 1,000,000,000,000,000,000 or 1E18 because cUSD has a size of 18 decimals. Solidity doesn't have support for floating point numbers, so the workaround is to make really large numbers. 1E18 cUSD is equal to $1 cUSD. 

Next, we call the ``startProject()`` method in our crowdfunding contract and pass in the parameters it requires. If you go back to the ``CeloCrowdfund.sol`` contract, you'll see the createProject() method takes in the following: 

```
function startProject(
  IERC20 cUSDToken,
  string calldata title,
  string calldata description,
  string calldata imageLink,
  uint durationInDays,
  uint amountToRaise
)
```

These are the parameters we supply when we call the function.

Now that we have that, we'll create a stableToken variable which uses the ``ContractKit`` stabletoken wrapper in order to get a reference to the cUSD coin, and we will call the ``createProject`` helper function inside ``interact()``. We'll also return all the projects in our contract using the ``returnProjects()`` function in our ``CeloCrowdfund`` contract, to verify that it worked: 

```
  // Print wallet address so we can check it on the block explorer
  console.log("Account address: ", account.address);

  // Get the cUSD ContractKit wrapper
  var stableToken = await kit.contracts.getStableToken();

  await createProject(celoCrowdfundContract, stableToken);
  
  // Return projects inside the celo crowdfund contract
  var result = await celoCrowdfundContract.methods.returnProjects().call();

  console.log("List of addressses for each of the projects created:", result);
```

If you run the code, you should see the new project created. 

## Sending money to a project

Now that we've created a project, we'll need to send some money to it. 

Just like how we created a variable called ``celoCrowdfundContract`` to access our ``CeloCrowdfund`` contract, we'll need to create a variable to access the ``Project`` contract. 

You can do this by writing the following: 

```
var projectInstanceContract = new web3.eth.Contract(
  Project.abi,
  deployedNetwork && result[0]
);
```

This will create a variable to access the first Project (``result[0]``) created in the list of projects returned by the ``returnProjects()`` function earlier. 

Now that we can access our project, we'll need to do two things in order to send cUSD to the contract. Since cUSD follows the [ERC-20](https://ethereum.org/en/developers/docs/standards/tokens/erc-20/) standard, we'll need to approve sending cUSD to the contract prior to sending money. After it's approved, we can send cUSD to our contract. 

To approve 5 cUSD to be sent, write the following: 
```
  var projectGoal = BigNumber(5E18);
  var result = await stableToken.approve(projectInstanceContract._address, projectGoal).sendAndWaitForReceipt({from: account.address});
```

After the above ``approve()``function runs, we will need to wait a couple of seconds to see the change on the blockchain before we send some cUSD. 

Create a helper function outside of the ``interact()`` function to cause a delay: 

```
const delay = ms => new Promise(res => setTimeout(res, ms));
```

Next, use ``delay()`` to wait 5 seconds in our ``interact()`` function:

```
  var projectGoal = BigNumber(5E18);
  var result = await stableToken.approve(projectInstanceContract._address, projectGoal).sendAndWaitForReceipt({from: account.address});

  console.log("Waiting 5s...")
  await delay(5000);
  console.log("Done waiting\n");
```

Great! Now we have approved our contract to receive 5 cUSD. The next step is to actually send some money. 

Outside of the ``interact()`` function, create a new function called ``contribute()``: 

```
async function contribute(stableToken, projectInstanceContract)  {
  var sendAmount = BigNumber(2E18);

  // Call contribute() function with 2 cUSD
  await projectInstanceContract.methods.contribute(sendAmount).send({from: account.address, feeCurrency: stableToken.address});
  
  console.log("Contributed to the project\n");
}
```

In the ``contribute()`` function, we create a variable called ``sendAmount`` which is set to 2E18. This is equivalent to 2 cUSD. Next, we use our ``projectInstanceContract`` variable to call the ``contribute()``function in our ``Project()`` contract. 

Back in our ``interact()`` function, let's call the ``contribute()`` helper function we created: 

```
  console.log("Waiting 5s...")
  await delay(5000);
  console.log("Done waiting\n");

  await contribute(stableToken, projectInstanceContract);
```

## Printing our balances

There are now two cUSD balances we care about: the balance of our Celo wallet, and the balance of our Project which the ``contribute() `` function sent 2 cUSD to. 

Outside the ``interact()`` function, create a helper function called ``createBalances()`` to print this all out: 

```
async function printBalances(stableToken, projectInstanceContract)  {

  var balanceOfUser = (await stableToken.balanceOf(account.address)).toString();

  console.log("User's address: ", account.address);
  console.log("User's cUSD balance: ", balanceOfUser/1E18, " cUSD\n");

  var balanceOfContract = (await stableToken.balanceOf(projectInstanceContract._address)).toString();
  
  console.log("Contract address: ", projectInstanceContract._address);
  console.log("Contract cUSD balance: ", balanceOfContract/1E18,  " cUSD\n");
}
```

The ``printBalances()`` function uses the ``stableToken`` variable's ``balanceOf()`` function in order to get our Celo wallet's cUSD balance. We then use that same ``balanceOf()`` function in order to get the balance of the contract, and then we print it all out. 

Next, inside the ``interact()`` function just call the ``printBalances()`` function after ``contribute()``:

```
await contribute(stableToken, projectInstanceContract);
await printBalances(stableToken, projectInstanceContract);
```

## Paying out from our Project contract

So far we're able to create a Project, and fund it. The final step is paying out from our contract!

Outside the ``interact()`` function, create a helper function called ``payOut()``: 

```
async function payOut(stableToken, projectInstanceContract)  {
  var payOut = await projectInstanceContract.methods.payOut().send({from: account.address, feeCurrency: stableToken.address});
  console.log("Paying out from project");
}
```
The ``payOut`` function calls the ``payOut()`` function inside our ``Project`` smart contract. This will send all the funds sent back to the project creator. 

Finally, let's call the ``payOut()`` helper function inside our ``interact()`` function: 

```
  await contribute(stableToken, projectInstanceContract);
  await printBalances(stableToken, projectInstanceContract);
  
  console.log("Waiting 5s...")
  await delay(5000);
  console.log("Done waiting\n");

  await payOut(stableToken, projectInstanceContract);
  
  console.log("After pay out: ");
  await printBalances(stableToken, projectInstanceContract);
```

We'll want to wait 5 seconds before printing just to make sure the payOut() transaction has been confirmed on the blockchain. 

Now let's run the code! In your terminal, type: 

```
node interact.js
```

You should see something like the following output: 

![output](https://i.imgur.com/P2uyevN.png)

Awesome! As you can see from the terminal output, our script creates a new project, contributes 2 cUSD to it, waits 5 seconds, and then pays out from the project. You can see the flow of the 2 cUSD going from your wallet --> the contract --> back to your wallet. 

It works!

# Conclusion

This three part series has shown you how to write a smart contract for Celo, deploy it, and then interact with the smart contract you created. 

You can use this third tutorial as a jumping off point for interacting with any smart contract you make using Javascript. Whether you're creating a web dApp or a mobile dApp, you can use this code in order to interact with your contracts. 

If you run into any problems along the way, feel free to ask questions on the Discord or view the source code [here](https://github.com/alexreyes/Celo-Crowdfunding-Tutorial-3)
