import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {parseEther} from 'ethers/lib/utils';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts} = hre;
	const {deploy} = deployments;

	const {deployer, seller, buyer} = await getNamedAccounts();

	const price = parseEther('110');

	const NFTDeployment = await deployments.get('NFT');
	const tokenContract = NFTDeployment.address;
	const tokenID = 48;

	await deploy('VendingMachine', {
		from: deployer,
		args: [seller, buyer, price, tokenContract, tokenID],
		log: true,
		autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
		linkedData: {
			seller,
			buyer,
			price,
			tokenContract,
			tokenID,
		},
	});
};
export default func;
func.tags = ['VendingMachine'];
func.dependencies = ['NFT'];
