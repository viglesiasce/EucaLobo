var ew_ReservedInstancesTreeView = {
    model: 'reservedInstances',

    isRefreshable: function() {
        for (var i in this.treeList) {
            if (this.treeList[i].state == "payment-pending") return true;
        }
        return false;
    },
};

ew_ReservedInstancesTreeView.__proto__ = TreeView;

var ew_LeaseOfferingsTreeView = {
    model: 'offerings',

    purchaseOffering : function()
    {
        var retVal = { ok : null, id : null, count : null };
        var image = this.getSelected();
        if (image == null) return;
        retVal.id = image.id;
        var fRepeat = true;

        while (fRepeat) {
            // Hand off receiving user input to a dialog
            window.openDialog("chrome://ew/content/dialogs/purchase_offering.xul", null, "chrome,centerscreen,modal,resizable", image, retVal);

            fRepeat = retVal.ok;
            if (retVal.ok) {
                // Ensure that the user actually wants to purchase this offering
                var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
                var check = null;
                var flags = prompts.BUTTON_TITLE_IS_STRING * prompts.BUTTON_POS_0 + prompts.BUTTON_TITLE_IS_STRING * prompts.BUTTON_POS_1 + prompts.BUTTON_TITLE_CANCEL * prompts.BUTTON_POS_2 + prompts.BUTTON_POS_0_DEFAULT;

                var msg = "You are about to purchase " + retVal.count + " " + image.description + " Reserved Instance(s) in the " + image.azone + " Availability Zone for $" + retVal.count * parseInt(image.fixedPrice);
                msg = msg + ". Are you sure?\n\nAn email will be sent to you shortly after we receive your order.";
                var button = prompts.confirmEx(window, "Confirm Reserved Instances Offering Purchase", msg, flags, "Edit Order", "Place Order", "", null, {});

                // Edit: 0, Purchase: 1, Cancel: 2
                if (button == 1) {
                    fRepeat = false;
                    this.core.api.purchaseOffering(retVal.id, retVal.count, function(id) { ew_ReservedInstancesTreeView.refresh(); });
                } else
                 if (button == 0) {
                     // The user wants to edit the order
                     continue;
                 } else {
                     fRepeat = false;
                 }
            }
        }
    },
};

ew_LeaseOfferingsTreeView.__proto__ = TreeView;
