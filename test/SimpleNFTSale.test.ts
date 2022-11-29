import {expect} from './chai-setup';
import {ethers, deployments, getUnnamedAccounts, getNamedAccounts} from 'hardhat';
import {SimpleNFTSale, NFT} from '../typechain';
import {setupUser, setupUsers} from './utils/users';
import {waitFor} from './utils';
import {BigNumber} from 'ethers';

const setup = deployments.createFixture(async () => {
	await deployments.fixture('SimpleNFTSale');
	const {deployer, seller, buyer} = await getNamedAccounts();
	const NFT = await deployments.deploy('NFT', {from: deployer});
	const {linkedData} = await deployments.get('SimpleNFTSale');
	const contracts = {
		SimpleNFTSale: <SimpleNFTSale>await ethers.getContract('SimpleNFTSale'),
		NFT: <NFT>await ethers.getContract('NFT'),
	};
	const users = await setupUsers(await getUnnamedAccounts(), contracts);
	return {
		...contracts,
		users,
		seller: await setupUser(seller, contracts),
		buyer: await setupUser(buyer, contracts),
		linkedData,
	};
});

describe('SimpleNFTSale', function () {
	it('correct NFT contract', async function () {
		const {NFT, linkedData} = await setup();
		const {tokenContract} = linkedData;
		expect(tokenContract).to.be.equal(NFT.address);
	});

	it('purchase succeed', async function () {
		const {seller, buyer, SimpleNFTSale, NFT, linkedData} = await setup();
		const {tokenID, price} = linkedData;

		await waitFor(seller.NFT.mint(seller.address, tokenID));
		await waitFor(seller.NFT.approve(SimpleNFTSale.address, tokenID));

		const balanceBefore = await ethers.provider.getBalance(seller.address);

		await expect(buyer.SimpleNFTSale.purchase({value: price}))
			.to.emit(NFT, 'Transfer')
			.withArgs(seller.address, buyer.address, tokenID);

		const balanceAfter = await ethers.provider.getBalance(seller.address);
		expect(balanceAfter.sub(balanceBefore)).to.be.equal(price);
	});

	it('purchase fails if not enough ETH sent', async function () {
		const {seller, buyer, SimpleNFTSale, linkedData} = await setup();
		const {tokenID, price} = linkedData;

		await waitFor(seller.NFT.mint(seller.address, tokenID));
		await waitFor(seller.NFT.approve(SimpleNFTSale.address, tokenID));

		await expect(buyer.SimpleNFTSale.purchase({value: BigNumber.from(price).sub(1)})).to.be.revertedWith(
			'NotEnoughETH'
		);
	});

	it('purchase fails if not correct buyer', async function () {
		const {users, seller, SimpleNFTSale, NFT, linkedData} = await setup();
		const {tokenID, price} = linkedData;

		await waitFor(seller.NFT.mint(seller.address, tokenID));
		await waitFor(seller.NFT.approve(SimpleNFTSale.address, tokenID));

		await expect(users[0].SimpleNFTSale.purchase({value: price})).to.be.revertedWith('NotAuthorizedBuyer');
	});
});
