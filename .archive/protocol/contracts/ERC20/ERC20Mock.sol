// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@opengsn/contracts/src/BaseRelayRecipient.sol";

contract ERC20Mock is BaseRelayRecipient, ERC20 {
    /*
    @notice constructor
    */
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) {
        _mint(msg.sender, initialSupply);
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