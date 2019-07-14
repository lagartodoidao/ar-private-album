import React from 'react';
import logo from './logo.svg';
import './App.css';
import 'semantic-ui-css/semantic.min.css'
import { Grid, Dimmer, Loader, Modal, Button, List, Icon} from 'semantic-ui-react'
import ReadWalletFile from './helpers/ReadWalletFile';
import Arweave from 'arweave/web';
import ReadImage from './helpers/ReadImage';
import CryptoJS from "crypto-js"
import jwkToPem from 'jwk-to-pem'

const arweave = Arweave.init({
    host: 'arweave.net',// Hostname or IP address for a Arweave node
    port: 80,           // Port, defaults to 1984
    protocol: 'https',  // Network protocol http or https, defaults to http
    timeout: 20000,     // Network request timeouts in milliseconds
    logging: false,     // Enable network request logging
})

const getImagesTxList = async(arAddress) => {
  try{
    const query = {
      op: 'and',
      expr1: {
          op: 'equals',
          expr1: 'from',
          expr2: arAddress
      },
      expr2: {
          op: 'equals',
          expr1: 'App-Name',
          expr2: 'arweave-private-album'
      }     
    }
    const result = await arweave.arql(query);
    return result
  }catch(err){
    console.log(err)
    return []
  }  
}


class App extends React.Component{
  state = {
    loading:false,
    walletLoad:false,
    userAddress:'',
    walletFile:'',
    arBalance:'',
    //tx details
    fee:'',
    transaction:'',
    //view img
    txView:'',
    imgDataView:'',
    openModalView:false
  }

  isFileImage = (file) => {
    return file && file['type'].split('/')[0] === 'image';
}

  WalletUpload = async(e) => {
    try{    
      this.setState({loading:true})
      const rawWallet = await ReadWalletFile(e.target.files[0])
      const walletFile = JSON.parse(rawWallet)
      const userAddress = await arweave.wallets.jwkToAddress(walletFile)
      const winstonBalance =  await arweave.wallets.getBalance(userAddress)
      const arBalance = await arweave.ar.winstonToAr(winstonBalance)
      const listTxImg = await getImagesTxList(userAddress)
      this.setState({walletLoad:true, walletFile, userAddress, arBalance, loading:false, listTxImg})
    }catch(err){
      this.setState({loading:false})
      alert('Error Loading Wallet')
    }
  }

  loadImage = async(e) => {
    try{
      this.setState({loading:true})
      // const validImg = await this.isFileImage(e.target.files[0])
      // console.log(validImg)
      const imgData = await ReadImage(e.target.files[0])
      if(imgData){
        const pvKey = await jwkToPem(this.state.walletFile,{private:true})
        const imgEncrypted = await CryptoJS.AES.encrypt(imgData, pvKey)
        const ImgEcryptedString = await imgEncrypted.toString()
        const data = ImgEcryptedString   
        let transaction = await arweave.createTransaction({
            data
        }, this.state.walletFile);
        transaction.addTag('App-Name', 'arweave-private-album');
        const fee = await arweave.ar.winstonToAr(transaction.reward)
        this.setState({fee, transaction, imgData, openModalTx:true, loading:false })   


      }else{
        this.setState({loading:false})
        alert('Only Images')
      }
    }catch(err){
      console.log(err)
      this.setState({loading:false})
      alert('Error Loading Image')
    }
}

close = () => {
  if(this.state.loading){
    return 
  }else{
    this.setState({ open: false })
  }
}

closeView = () => this.setState({openModalView:false})

  confirmUploadImage = async() => {
    try{
      this.setState({loading:true})
      const transaction = this.state.transaction
      await arweave.transactions.sign(transaction, this.state.walletFile);
      const response = await arweave.transactions.post(transaction);
      console.log(transaction.id)
      let {status} = await arweave.transactions.getStatus(transaction.id)
      this.setState({loading:false, openModalTx:false, fee:'', transaction:'', imgData:''})
      alert('Transaction Send, after the confirmation you will view this')
    }catch(err){
      this.setState({loading:false, openModalTx:false, fee:'', transaction:'', imgData:''})
      alert('Error')
    }
  }

  decryptImage = async(txHash) => {
     try{
      this.setState({loading:true})
      const transaction = await arweave.transactions.get(txHash)
      const encryptData = await transaction.get('data', {decode: true, string: true})
      const pvKey = await jwkToPem(this.state.walletFile,{private:true})
      var decryptResult  = await CryptoJS.AES.decrypt(encryptData, pvKey);
      const imgString = await decryptResult.toString(CryptoJS.enc.Utf8)
      this.setState({loading:false, txView:txHash, imgDataView:imgString, openModalView:true})
     }catch(err){
       console.log(err)
       this.setState({loading:false})
       alert('Error')
   }
  }

  render(){
    return(
      <React.Fragment>
      <Grid padded>
        <Grid.Row color={"black"} key={"black"}>
          <Grid.Column>AR Private Album</Grid.Column>
        </Grid.Row>
       </Grid>
        <Grid centered> 
        {this.state.walletLoad ?
        <React.Fragment>
            <Grid centered>
            <Grid.Row style={{padding:0}}><p>{this.state.userAddress}</p></Grid.Row>
            <Grid.Row style={{padding:0}}> <p>{this.state.arBalance} AR</p></Grid.Row>
           
            <Grid.Row>
            <label style={{padding:20}} for="upload-img" class="ui icon button">
              <i class="upload icon"></i>
              Load Image
            </label>
            <input type="file" accept="image/*" onChange={ e => this.loadImage(e)} id="upload-img" style={{display: "none"}}/>
            </Grid.Row>
            <Grid.Row>
              <p style={{fontWeight:800, fontSize:18}}>Image List</p>
            </Grid.Row>
            {(this.state.listTxImg.length === 0) && <Grid.Row><p>No Images</p></Grid.Row>}
            <Grid.Row>
              <List>
                {this.state.listTxImg.map(url => (
                      <List.Item>
                        <List.Content>
                          <List.Header onClick={() => this.decryptImage(url)} as='a'>{url}</List.Header>
                        </List.Content>
                    </List.Item>
                ))}
              </List>
            </Grid.Row>
            </Grid>
        </React.Fragment>
          :
          <React.Fragment>
            <label style={{padding:20}} for="hidden-new-file" class="ui icon button">
              <i class="sync icon"></i>
              Load Wallet
            </label>
            <input type="file" onChange={ e => this.WalletUpload(e)} id="hidden-new-file" style={{display: "none"}}/>
          </React.Fragment>

        }     
        </Grid>
        {this.state.loading && 
          <Dimmer active>
            <Loader size='small'>Loading</Loader>
          </Dimmer>
        }

        <Modal size={"medium"} open={this.state.openModalTx} onClose={this.close}>
        {this.state.loading && 
          <Dimmer active>
            <Loader size='small'>Loading</Loader>
          </Dimmer>
        }
          <Modal.Header>Upload Image</Modal.Header>
          <Modal.Content>
            <Grid centered>
                <Grid.Row>
                  <p>Transaction Fee: {this.state.fee}</p>
                </Grid.Row>
                <Grid.Row>
                  <img src={this.state.imgData} style={{maxWidth:350, maxHeight:350}} />
                </Grid.Row>
            </Grid>
          </Modal.Content>
          <Modal.Actions>
            <Button onClick={() => this.setState({openModalTx:false, fee:'' , transaction:'', imgData:''})} negative>Cancel</Button>
            <Button onClick={this.confirmUploadImage} positive icon='checkmark' labelPosition='right' content='Upload Image' />
          </Modal.Actions>
        </Modal>

        <Modal size={"medium"} open={this.state.openModalView} onClose={this.closeView}>
          <Modal.Header>View Image</Modal.Header>
          <Modal.Content>
            <Grid centered>
              <Grid.Row>
                <p>Tx: {this.state.txView}</p>
              </Grid.Row>
              <Grid.Row>
                <img src={this.state.imgDataView} style={{maxWidth:350, maxHeight:350}} />
              </Grid.Row>
            </Grid>
          </Modal.Content>
        </Modal>
      </React.Fragment>
    )
  }
}

export default App;
