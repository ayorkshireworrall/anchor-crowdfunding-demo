import './App.css';
import { useEffect, useState } from 'react';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { Program, AnchorProvider, web3, utils, BN } from '@coral-xyz/anchor';
import { Buffer } from 'buffer';

import idl from './idl.json';

window.Buffer = Buffer;

const programId = new PublicKey(idl.metadata.address);
const network = clusterApiUrl('devnet');
const opts = {
  preflightCommitment: 'processed'
}
const { SystemProgram } = web3;

const App = () => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const initialCampaignData = {
    name: '',
    description: ''
  }
  const [campaignData, setCampaignData] = useState(initialCampaignData)

  const handleInputChange = (input, e) => {
    let data = { ...campaignData }
    data[input] = e.target.value
    setCampaignData(data)
  }

  const getProvider = () => {
    const connection = new Connection(network, opts.preflightCommitment);
    const provider = new AnchorProvider(connection, window.solana, opts.preflightCommitment);
    return provider;
  }

  const checkIfWalletIsConnected = async () => {
    try {
      const { solana } = window;
      if (solana && solana.isPhantom) {
        console.log('Phantom wallet found!');
        const response = await solana.connect({
          onlyIfTrusted: true
        });
        console.log('Connected with public key: ', response.publicKey.toString());
        setWalletAddress(response.publicKey.toString());
      } else {
        alert("Solana object not found! Get a Phantom wallet")
      }
    } catch (error) {
      console.log(error)
    }
  }

  const connectWallet = async () => {
    console.log('Connecting wallet');
    const { solana } = window;
    if (solana) {
      const response = await solana.connect();
      console.log('Connected with public key: ', response.publicKey.toString());
      setWalletAddress(response.publicKey.toString());
    }
  }

  const getCampaigns = async () => {
    const connection = new Connection(network, opts.preflightCommitment);
    const provider = getProvider();
    const program = new Program(idl, programId, provider);

    Promise.all(
      (await connection.getProgramAccounts(programId)).map(
        async (campaign) => ({
          ...(await program.account.campaign.fetch(campaign.pubkey)),
          pubkey: campaign.pubkey,
        })
      )
    ).then((campaigns) => {
      console.log('Campaigns found: ', campaigns);
      setCampaigns(campaigns)
    });
  }

  const createCampaign = async (name, description) => {
    console.log(`Creating a campaign with name ${name} and description ${description}`)
    try {
      const provider = getProvider();
      const program = new Program(idl, programId, provider);
      console.log(program.programId.toString())
      const [campaign] = PublicKey.findProgramAddressSync([
        utils.bytes.utf8.encode('campaign'),
        utils.bytes.utf8.encode(name)
      ], program.programId);

      console.log(campaign.toString())
      await program.methods
        .create(name, description)
        .accounts({
          campaign,
          user: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId
        })
        .rpc();
      console.log('Created a new campaign with address: ', campaign.toString());
    } catch (error) {
      console.error(error)
    }
  }

  const donate = async (campaignKey, campaignName, amount) => {
    console.log(`A donation of ${amount} has been requested to the campaign with ID ${campaignKey}`)
    try {
      const provider = getProvider();
      const program = new Program(idl, programId, provider);

      await program.methods
        .donate(campaignName, new BN(amount * web3.LAMPORTS_PER_SOL))
        .accounts({
          campaign: campaignKey,
          user: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId
        })
        .rpc();
      console.log(`${amount} has been donated to the campaign with ID ${campaignKey}`)
    } catch (error) {
      console.error('Error donating: ', error)
    }
  }

  const withdraw = async (campaignKey, campaignName, amount) => {
    console.log('About to withdraw from campaign ', campaignKey.toString());
    try {
      const provider = getProvider();
      const program = new Program(idl, programId, provider);

      await program.methods
        .withdraw(campaignName, new BN(amount * web3.LAMPORTS_PER_SOL))
        .accounts({
          campaign: campaignKey,
          user: provider.wallet.publicKey
        })
        .rpc();
      console.log('Successfully withdrawn from the campaign')
    } catch (error) {
      console.error('Error withdrawing from campaign: ', error);
    }
  }

  const renderNotConnectedContainer = () => {
    return <button onClick={connectWallet}>Connect to Wallet</button>
  }

  const renderConnectedContainer = () => {
    return (
      <>
        <p>Name:</p>
        <input onChange={e => handleInputChange('name', e)} value={campaignData['name']} />
        <p>Description:</p>
        <input onChange={e => handleInputChange('description', e)} value={campaignData['description']} />
        <button onClick={() => createCampaign(campaignData['name'], campaignData['description'])}>Create a Campaign</button>
        <button onClick={getCampaigns}>Get a list of campaigns</button>
        <br />
        {campaigns.map(campaign => {
          return (
            <>
              <p>Campaign ID: {campaign.pubkey.toString()}</p>
              <p>Balance: {(campaign.amountDonated / web3.LAMPORTS_PER_SOL).toString()}</p>
              <p>Name: {campaign.name}</p>
              <p>Description: {campaign.description}</p>
              <button onClick={() => donate(campaign.pubkey, campaign.name, 0.2)}>Click To Donate</button>
              <button onClick={() => withdraw(campaign.pubkey, campaign.name, 0.2)}>Click To Withdraw</button>
            </>
          )
        })}
      </>
    )
  }



  useEffect(() => {
    const onLoad = async () => {
      await checkIfWalletIsConnected();
    }
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);

  return (
    <div className='AppContainer'>
      {!walletAddress && renderNotConnectedContainer()}
      {walletAddress && renderConnectedContainer()}
    </div>
  )
}

export default App;
