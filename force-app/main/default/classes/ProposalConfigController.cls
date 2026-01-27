
public with sharing class ProposalConfigController {

    // READ config
    @AuraEnabled(cacheable=true)
    public static String getProposalConfig() {
        try {
            Proposal_Config__mdt config =
                Proposal_Config__mdt.getInstance('ProposalConfig');

            return config != null ? config.Config_JSON__c : null;

        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    // SAVE config (all data in one JSON field)
    @AuraEnabled
    public static void saveProposalConfig(
        Decimal ohValue,
        Decimal warrantyValue,
        Decimal profitValue,
        String warrantyArea,
        String agreement,
        String limitations
    ) {
        try {
            // Prepare JSON
            Map<String, Object> data = new Map<String, Object>{
                'ohValue' => ohValue,
                'warrantyValue' => warrantyValue,
                'profitValue' => profitValue,
                'warrantyArea' => warrantyArea,
                'agreement' => agreement,
                'limitations' => limitations
            };

            String jsonData = JSON.serialize(data);

            // Custom Metadata update (simple & clean)
            Metadata.CustomMetadata mdata = new Metadata.CustomMetadata();
            mdata.fullName = 'Proposal_Config__mdt.ProposalConfig';
            mdata.label = 'ProposalConfig';

            Metadata.CustomMetadataValue val = new Metadata.CustomMetadataValue();
            val.field = 'Config_JSON__c';
            val.value = jsonData;
            mdata.values.add(val);

            Metadata.DeployContainer container = new Metadata.DeployContainer();
            container.addMetadata(mdata);
            Metadata.Operations.enqueueDeployment(container, null);

        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}
