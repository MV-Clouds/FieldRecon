public with sharing class ScheduleSetupService {
    public static List<ColorStatusWrapper> getMobilizationStatuses() {
        List<Mobilization_Status_Color__c> listStatusColor = Mobilization_Status_Color__c.getAll().values();
        List<ColorStatusWrapper> listStatusColorWrapper = new List<ColorStatusWrapper>();

        // Get Mobilization Status Picklist Values
        Schema.DescribeFieldResult fieldResult = Mobilization__c.Mobilization_Status__c.getDescribe();
        List<Schema.PicklistEntry> listMobilizationPicklistValues = fieldResult.getPicklistValues();

        Set<String> setStatusValues = new Set<String>();
        Set<String> setNewStatusValues = new Set<String>();

        for (Schema.PicklistEntry ple : listMobilizationPicklistValues) {
            if (ple.isActive()) {
                setStatusValues.add(ple.getLabel());
            }
        }

        for (Mobilization_Status_Color__c msc : listStatusColor) {
            if (setStatusValues.contains(msc.Name)) {
                setNewStatusValues.add(msc.Name);

                ColorStatusWrapper scw = new ColorStatusWrapper();
                scw.Status = msc.Name;
                scw.backgroundColor = msc.Background_Color__c;
                scw.textColor = msc.Color__c;
                scw.settingId = msc.id;

                listStatusColorWrapper.add(scw);
            }
        }

        for (String strStatus : setStatusValues) {
            if (!setNewStatusValues.contains(strStatus)) {
                ColorStatusWrapper scw = new ColorStatusWrapper();
                scw.Status = strStatus;
                scw.backgroundColor = '#FFFFFF';
                scw.textColor = '#000000';

                listStatusColorWrapper.add(scw);
            }
        }

        return listStatusColorWrapper;
    }

    public static List<ColorStatusWrapper> getAssetTypeVehicle() {
        Mobilization_Status_Color__c assetTypeVehicleColor = Mobilization_Status_Color__c.getValues('Vehicle');
        List<ColorStatusWrapper> listStatusColorWrapper = new List<ColorStatusWrapper>();

        if (assetTypeVehicleColor == null) {
            assetTypeVehicleColor = new Mobilization_Status_Color__c();
            assetTypeVehicleColor.Name = 'Vehicle';

            assetTypeVehicleColor.Background_Color__c = '#FFFFFF';
            assetTypeVehicleColor.Color__c = '#000000';
        }

        ColorStatusWrapper scw = new ColorStatusWrapper();
        scw.status = assetTypeVehicleColor.Name;
        scw.backgroundColor = assetTypeVehicleColor.Background_Color__c;
        scw.textColor = assetTypeVehicleColor.Color__c;
        scw.settingId = assetTypeVehicleColor.id;

        listStatusColorWrapper.add(scw);

        return listStatusColorWrapper;
    }
}