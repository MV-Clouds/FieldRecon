({
    handleUploadFinished: function (component, event, helper) {
        // Get the list of uploaded files
        console.log(component.get('v.recordId'));
        var uploadedFiles = event.getParam("files");
        component.set('v.fileLists',uploadedFiles);
        helper.successToast(component, event, helper);
    }
})