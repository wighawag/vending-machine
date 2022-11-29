// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract VendingMachine {
	error NotAuthorized();
	error NotAuthorizedBuyer();
	error NotEnoughETH();
	error NotSellingThisNFT();

	address payable immutable seller;
	address payable immutable buyer;
	uint256 immutable price;
	IERC721 immutable tokenContract;
	uint256 immutable tokenID;

	constructor(
		address payable seller_,
		address payable buyer_,
		uint256 price_,
		IERC721 tokenContract_,
		uint256 tokenID_
	) {
		seller = seller_;
		buyer = buyer_;
		price = price_;
		tokenContract = tokenContract_;
		tokenID = tokenID_;
	}

	// allow the seller to get the NFT back if sale is not performed
	function withdrawNFT(
		IERC721 tokenContractToWithdraw,
		uint256 tokenIDToWithdraw,
		address to
	) external {
		if (msg.sender != seller) {
			revert NotAuthorized();
		}
		tokenContractToWithdraw.safeTransferFrom(address(this), to, tokenIDToWithdraw);
	}

	// if we want to let the contract own the NFT for the sale
	function onERC721Received(
		address,
		address,
		uint256 tokenId,
		bytes calldata
	) external view returns (bytes4) {
		if (tokenId != tokenID) {
			revert NotSellingThisNFT();
		}
		return IERC721Receiver.onERC721Received.selector;
	}

	// purchase the NFT by providing price in ETH
	function purchase() external payable {
		_purchase(tokenContract.ownerOf(tokenID), msg.sender);
	}

	// purchase the NFT by providing price in ETH
	function purchaseFor(address to) external payable {
		_purchase(tokenContract.ownerOf(tokenID), to);
	}

	// ------------------------------------------------------------------------------------------------------------------
	// INTERNAL
	// ------------------------------------------------------------------------------------------------------------------

	function _purchase(address currentOwner, address to) public payable {
		// only specified buyer can buy
		if (msg.sender != buyer) {
			revert NotAuthorizedBuyer();
		}
		// ensure price is paid
		if (msg.value < price) {
			revert NotEnoughETH();
		}

		// send payment directly to seller;
		seller.transfer(msg.value);

		// transfer nft to buyer chosen address (to)
		// Note that tx will revert if that call fails, so the purchase is atomic
		tokenContract.safeTransferFrom(currentOwner, to, tokenID);
	}
}
