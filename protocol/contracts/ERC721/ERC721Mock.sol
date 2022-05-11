// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@opengsn/contracts/src/BaseRelayRecipient.sol";



/*
    Standard ERC721 Token, with follwoing functionalities:
    * mint new token
    * burn token
    * set token uri
    * set base uri
    * pause and unpause contract
*/
contract ERC721Mock is BaseRelayRecipient, Ownable, ERC721Pausable, ReentrancyGuard {
    uint256 public idTracker;
    string public baseURI = "https://google.com";

    /*
    @notice the constructor function is fired only once during contract deployment
    @dev assuming all NFT URI metadata is based on a URL he baseURI would be something like https://
    */
    constructor(string memory _name, string memory _symbol, address _owner)
    ERC721(_name, _symbol)
    {
        idTracker = 1;
        transferOwnership(_owner);
    }

    /*
    @notice set base uri
    @param uri string
    */
    function setBaseURI(string memory uri) external onlyOwner {
        baseURI = uri;
    }

    /*
    @notice read base uri
    @return uri string
    */
    function _baseURI() internal override view returns (string memory) {
        return baseURI;
    }

    /*
    @notice mintNewNFT allows the owner of this contract to mint an input address a newNFT
    @param _to is the address the NFT is being minted to
    */
    function mintNewNFT(
        address _to
    ) public onlyOwner nonReentrant {
        _safeMint(_to, idTracker);
        idTracker++;
    }

    /*
    @notice mintNewNFTWithData allows user(collectionMinter, if set) of this contract to mint an input address a newNFT
    @param _to is the address the NFT is being minted to
    @param _tokenURI is the tokenURI
    @param _data additional data to be sent to contract
    */
    function mintNewNFTWithData(
        address _to,
        bytes memory _data
    ) public onlyOwner nonReentrant {
        _safeMint(_to, idTracker, _data);
        idTracker++;
    }

    /*
    @notice burn allows user(approved user) to burn an token
    @param _tokenId is the token to burn
    */
    function burn(uint256 tokenId) external {
        require(_isApprovedOrOwner(_msgSender(), tokenId), "ERC721: burn caller is not owner nor approved");
        _burn(tokenId);
    }

    /*
    @notice pause contract, functionalities like transfer, mint and burn will be unavailable
    */
    function pause() external onlyOwner {
        _pause();
    }

    /*
    @notice unpause contract, functionalities like transfer, mint and burn will be available
    */
    function unpause() external onlyOwner {
        _unpause();
    }


        // support for opengsn
    string public override versionRecipient = "2.2.0";

    /*
    @notice get msgSender from relayer
    */
    function _msgSender() internal view override(Context, BaseRelayRecipient)
    returns (address sender) {
        sender = BaseRelayRecipient._msgSender();
    }

    /*
    @notice get msgData from relayer
    */
    function _msgData() internal view override(Context, BaseRelayRecipient)
    returns (bytes memory) {
        return BaseRelayRecipient._msgData();
    }
}