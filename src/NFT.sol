// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "solidity-kit/solc_0.8/ERC721/implementations/BasicERC721.sol";

contract NFT is BasicERC721 {
	function mint(address to, uint256 tokenID) external {
		_safeMint(to, tokenID);
	}
}
