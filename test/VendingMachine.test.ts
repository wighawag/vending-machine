import {expect} from './chai-setup';
import {ethers, deployments, getUnnamedAccounts, getNamedAccounts} from 'hardhat';
import {VendingMachine, NFT} from '../typechain';
import {setupUser, setupUsers, User} from './utils/users';
import {waitFor} from './utils';
import {BigNumber} from 'ethers';

const setup = deployments.createFixture(async () => {
	await deployments.fixture('VendingMachine');
	const {deployer, seller, buyer} = await getNamedAccounts();
	const NFT = await deployments.deploy('NFT', {from: deployer});
	const {linkedData} = await deployments.get('VendingMachine');
	const contracts = {
		VendingMachine: <VendingMachine>await ethers.getContract('VendingMachine'),
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

async function mint(tokenID: string, to: User<any, any>) {
	let owner;
	try {
		owner = await to.NFT.callStatic.ownerOf(tokenID);
	} catch (e) {}
	if (owner != to.address) {
		await waitFor(to.NFT.mint(to.address, tokenID));
	}
}

describe('VendingMachine', function () {
	it('correct NFT contract', async function () {
		const {NFT, linkedData} = await setup();
		const {tokenContract} = linkedData;
		expect(tokenContract).to.be.equal(NFT.address);
	});

	it('purchase succeed', async function () {
		const {seller, buyer, VendingMachine, NFT, linkedData} = await setup();
		const {tokenID, price} = linkedData;

		await mint(tokenID, seller);

		await waitFor(seller.NFT.approve(VendingMachine.address, tokenID));

		const balanceBefore = await ethers.provider.getBalance(seller.address);

		await expect(buyer.VendingMachine.purchase({value: price}))
			.to.emit(NFT, 'Transfer')
			.withArgs(seller.address, buyer.address, tokenID);

		const newOwner = await NFT.ownerOf(tokenID);
		expect(newOwner).to.be.equal(buyer.address);

		const balanceAfter = await ethers.provider.getBalance(seller.address);
		expect(balanceAfter.sub(balanceBefore)).to.be.equal(price);
	});

	it('purchase fails if not enough ETH sent', async function () {
		const {seller, buyer, VendingMachine, linkedData} = await setup();
		const {tokenID, price} = linkedData;

		await mint(tokenID, seller);
		await waitFor(seller.NFT.approve(VendingMachine.address, tokenID));

		await expect(buyer.VendingMachine.purchase({value: BigNumber.from(price).sub(1)})).to.be.revertedWith(
			'NotEnoughETH'
		);
	});

	it('purchase fails if not correct buyer', async function () {
		const {users, seller, VendingMachine, NFT, linkedData} = await setup();
		const {tokenID, price} = linkedData;

		await mint(tokenID, seller);
		await waitFor(seller.NFT.approve(VendingMachine.address, tokenID));

		await expect(users[0].VendingMachine.purchase({value: price})).to.be.revertedWith('NotAuthorizedBuyer');
	});

	it('purchase succeeds even if too much ETH', async function () {
		const {seller, buyer, VendingMachine, NFT, linkedData} = await setup();
		const {tokenID, price} = linkedData;

		await mint(tokenID, seller);
		await waitFor(seller.NFT.approve(VendingMachine.address, tokenID));

		const balanceBefore = await ethers.provider.getBalance(seller.address);

		const value = BigNumber.from(price).add(1);
		await expect(buyer.VendingMachine.purchase({value}))
			.to.emit(NFT, 'Transfer')
			.withArgs(seller.address, buyer.address, tokenID);

		const newOwner = await NFT.ownerOf(tokenID);
		expect(newOwner).to.be.equal(buyer.address);

		const balanceAfter = await ethers.provider.getBalance(seller.address);
		expect(balanceAfter.sub(balanceBefore)).to.be.equal(value);
	});

	it('purchase succeeds when specifying a different to address', async function () {
		const {seller, users, buyer, VendingMachine, NFT, linkedData} = await setup();
		const {tokenID, price} = linkedData;
		const to = users[1].address;

		await mint(tokenID, seller);
		await waitFor(seller.NFT.approve(VendingMachine.address, tokenID));

		const balanceBefore = await ethers.provider.getBalance(seller.address);

		const value = BigNumber.from(price).add(1);
		await expect(buyer.VendingMachine.purchaseFor(to, {value}))
			.to.emit(NFT, 'Transfer')
			.withArgs(seller.address, to, tokenID);

		const newOwner = await NFT.ownerOf(tokenID);
		expect(newOwner).to.be.equal(to);

		const balanceAfter = await ethers.provider.getBalance(seller.address);
		expect(balanceAfter.sub(balanceBefore)).to.be.equal(value);
	});

	it('purchase succeed when NFT sent to vending machine', async function () {
		const {seller, buyer, VendingMachine, NFT, linkedData} = await setup();
		const {tokenID, price} = linkedData;

		await mint(tokenID, seller);
		await waitFor(
			seller.NFT['safeTransferFrom(address,address,uint256)'](seller.address, VendingMachine.address, tokenID)
		);

		const balanceBefore = await ethers.provider.getBalance(seller.address);

		await expect(buyer.VendingMachine.purchase({value: price}))
			.to.emit(NFT, 'Transfer')
			.withArgs(VendingMachine.address, buyer.address, tokenID);

		const newOwner = await NFT.ownerOf(tokenID);
		expect(newOwner).to.be.equal(buyer.address);

		const balanceAfter = await ethers.provider.getBalance(seller.address);
		expect(balanceAfter.sub(balanceBefore)).to.be.equal(price);
	});

	it('cannot send any NFT to vending machine', async function () {
		if ((await deployments.getNetworkName()) === 'mainnet') {
			console.log(`skipping test on mainnet...`);
			return;
		}
		const {seller, VendingMachine, linkedData} = await setup();
		const {tokenID: originalTokenID} = linkedData;
		const tokenID = originalTokenID + 1;

		await mint(tokenID, seller);
		await expect(
			seller.NFT['safeTransferFrom(address,address,uint256)'](seller.address, VendingMachine.address, tokenID)
		).to.be.revertedWith('NotSellingThisNFT');
	});

	it('seller can withdraw after NFT sent to vending machine', async function () {
		const {users, seller, VendingMachine, NFT, linkedData} = await setup();
		const {tokenID} = linkedData;

		await mint(tokenID, seller);
		await waitFor(
			seller.NFT['safeTransferFrom(address,address,uint256)'](seller.address, VendingMachine.address, tokenID)
		);

		await expect(seller.VendingMachine.withdrawNFT(NFT.address, tokenID, users[0].address))
			.to.emit(NFT, 'Transfer')
			.withArgs(VendingMachine.address, users[0].address, tokenID);
	});

	it('buyer cannot buy if NFT is withdrawn', async function () {
		const {users, buyer, seller, VendingMachine, NFT, linkedData} = await setup();
		const {tokenID, price} = linkedData;

		await mint(tokenID, seller);
		await waitFor(
			seller.NFT['safeTransferFrom(address,address,uint256)'](seller.address, VendingMachine.address, tokenID)
		);
		await waitFor(seller.VendingMachine.withdrawNFT(NFT.address, tokenID, users[0].address));

		await expect(buyer.VendingMachine.purchase({value: price})).to.be.reverted;
	});

	it('buyer cannot buy if NFT not sent or approved', async function () {
		const {buyer, seller, linkedData} = await setup();
		const {tokenID, price} = linkedData;

		await mint(tokenID, seller);
		await expect(buyer.VendingMachine.purchase({value: price})).to.be.reverted;
	});

	it('nobody else can withdraw after NFT sent to vending machine', async function () {
		const {users, seller, buyer, VendingMachine, NFT, linkedData} = await setup();
		const {tokenID} = linkedData;

		await mint(tokenID, seller);
		await waitFor(
			seller.NFT['safeTransferFrom(address,address,uint256)'](seller.address, VendingMachine.address, tokenID)
		);

		await expect(buyer.VendingMachine.withdrawNFT(NFT.address, tokenID, buyer.address)).to.be.revertedWith(
			'NotAuthorized'
		);

		await expect(users[0].VendingMachine.withdrawNFT(NFT.address, tokenID, users[1].address)).to.be.revertedWith(
			'NotAuthorized'
		);
	});

	it('cannot sent ETH to contract', async function () {
		const {users, VendingMachine} = await setup();
		await expect(users[0].signer.sendTransaction({to: VendingMachine.address, value: 1})).to.be.reverted;
	});
});
