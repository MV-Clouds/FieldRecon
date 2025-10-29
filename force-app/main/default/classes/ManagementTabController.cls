public with sharing class ManagementTabController {

    public static final String CLASSNAME = 'ManagementTabController';

    @AuraEnabled
    public static List<Process__c> getProcessLibraries() {
        List<Process__c> processLibraries = new List<Process__c>();
        
        try {
            processLibraries = [
                SELECT Id, Name, Process_Name__c, Weight__c, Unit_of_Measure__c, Process_Type__c
                FROM Process__c
                WITH USER_MODE
                ORDER BY CreatedDate DESC
            ];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getProcessLibraries', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error fetching Process Libraries : ' + e.getMessage(), 'apiResponse' => null});
        }

        return processLibraries;
    }

    @AuraEnabled
    public static List<Crew__c> getCrewMembers() {
        List<Crew__c> crewMembers = new List<Crew__c>();
        
        try {
            crewMembers = [
                SELECT Id, Name, Description__c, Color_Code__c, Crew_Member_Count__c
                FROM Crew__c
                WITH USER_MODE
                ORDER BY CreatedDate DESC
            ];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getCrewMembers', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error fetching Crew Members : ' + e.getMessage(), 'apiResponse' => null});
        }

        return crewMembers;
    }

    @AuraEnabled
    public static Map<String, Object> getCrewMobilizationSummary(Id crewId) {
        Map<String, Object> response = new Map<String, Object>{
            'upcomingMobilizations' => 0
        };

        if (crewId == null) {
            return response;
        }

        try {
            Date today = Date.today();
            Set<Id> mobilizationIds = new Set<Id>();

            for (Mobilization_Member__c crewMobilization : [
                SELECT Mobilization__c
                FROM Mobilization_Member__c
                WHERE Crew__c = :crewId
                AND Mobilization__r.Start_Date__c >= :today
                AND Mobilization__c != null
                WITH USER_MODE
            ]) {
                if (crewMobilization.Mobilization__c != null) {
                    mobilizationIds.add(crewMobilization.Mobilization__c);
                }
            }

            response.put('upcomingMobilizations', mobilizationIds.size());
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'getCrewMobilizationSummary',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error fetching crew mobilization summary : ' + e.getMessage(),
                'apiResponse' => null
            });
        }

        return response;
    }

    @AuraEnabled
    public static Map<String, Object> saveCrew(Map<String, Object> crewData) {
        Map<String, Object> response = new Map<String, Object>{
            'status' => 'ERROR',
            'message' => 'Unable to save crew.'
        };
        Integer mobilizationsEvaluated = 0;
        Integer mobilizationAssignmentsCreated = 0;

        try {
            if (crewData == null || crewData.isEmpty()) {
                response.put('message', 'Crew details are required.');
                return response;
            }

            Object idValue = crewData.get('Id');
            Id crewId;
            if (idValue != null) {
                crewId = idValue instanceof Id ? (Id)idValue : Id.valueOf(String.valueOf(idValue));
            }

            String crewName = (String)crewData.get('Name');
            if (String.isBlank(crewName)) {
                response.put('message', 'Crew name is required.');
                return response;
            }

            Crew__c crewRecord = new Crew__c();
            crewRecord.Name = crewName;
            if (crewId != null) {
                crewRecord.Id = crewId;
            }

            if (crewData.containsKey('Description__c')) {
                crewRecord.Description__c = (String)crewData.get('Description__c');
            }

            if (crewData.containsKey('Color_Code__c')) {
                String colorCode = (String)crewData.get('Color_Code__c');
                if (!String.isBlank(colorCode) && !colorCode.startsWith('#')) {
                    colorCode = '#' + colorCode;
                }
                crewRecord.Color_Code__c = colorCode;
            }

            List<Id> membersToAdd = new List<Id>();
            if (crewData.containsKey('membersToAdd') && crewData.get('membersToAdd') != null) {
                for (Object memberVal : (List<Object>)crewData.get('membersToAdd')) {
                    if (memberVal == null) {
                        continue;
                    }
                    membersToAdd.add(memberVal instanceof Id ? (Id)memberVal : Id.valueOf(String.valueOf(memberVal)));
                }
            }

            List<Id> memberRecordIdsToRemove = new List<Id>();
            if (crewData.containsKey('membersToRemove') && crewData.get('membersToRemove') != null) {
                for (Object memberVal : (List<Object>)crewData.get('membersToRemove')) {
                    if (memberVal == null) {
                        continue;
                    }
                    memberRecordIdsToRemove.add(memberVal instanceof Id ? (Id)memberVal : Id.valueOf(String.valueOf(memberVal)));
                }
            }

            Boolean assignToFutureMobilizations = false;
            if (crewData.containsKey('assignToFutureMobilizations') && crewData.get('assignToFutureMobilizations') != null) {
                Object assignValue = crewData.get('assignToFutureMobilizations');
                if (assignValue instanceof Boolean) {
                    assignToFutureMobilizations = (Boolean)assignValue;
                } else {
                    assignToFutureMobilizations = 'true'.equalsIgnoreCase(String.valueOf(assignValue));
                }
            }

            if (crewRecord.Id == null) {
                insert crewRecord;
            } else {
                update crewRecord;
            }

            crewId = crewRecord.Id;

            if (!memberRecordIdsToRemove.isEmpty()) {
                List<Crew_Member__c> membersToDelete = [
                    SELECT Id
                    FROM Crew_Member__c
                    WHERE Id IN :memberRecordIdsToRemove
                    WITH USER_MODE
                ];

                if (!membersToDelete.isEmpty()) {
                    delete membersToDelete;
                }
            }

            if (!membersToAdd.isEmpty()) {
                Set<Id> contactIdsToInsert = new Set<Id>(membersToAdd);

                List<Crew_Member__c> existingMembers = [
                    SELECT Id, Contact__c
                    FROM Crew_Member__c
                    WHERE Crew__c = :crewId AND Contact__c IN :contactIdsToInsert
                    WITH USER_MODE
                ];

                for (Crew_Member__c existingMember : existingMembers) {
                    contactIdsToInsert.remove(existingMember.Contact__c);
                }

                if (!contactIdsToInsert.isEmpty()) {
                    List<Crew_Member__c> membersToInsert = new List<Crew_Member__c>();
                    for (Id contactId : contactIdsToInsert) {
                        membersToInsert.add(new Crew_Member__c(Crew__c = crewId, Contact__c = contactId));
                    }
                    insert membersToInsert;

                    if (assignToFutureMobilizations) {
                        MobilizationPropagationResult propagationResult = handleMobilizationPropagation(crewId, contactIdsToInsert);
                        mobilizationsEvaluated = propagationResult.mobilizationsEvaluated;
                        mobilizationAssignmentsCreated = propagationResult.assignmentsCreated;
                    }
                }
            }

            Integer memberCount;
            if (crewData.containsKey('selectedMemberIds') && crewData.get('selectedMemberIds') != null) {
                memberCount = ((List<Object>)crewData.get('selectedMemberIds')).size();
            } else {
                memberCount = [
                    SELECT COUNT()
                    FROM Crew_Member__c
                    WHERE Crew__c = :crewId
                ];
            }

            response.put('status', 'SUCCESS');
            response.put('message', 'Crew saved successfully.');
            response.put('crewId', crewId);
            response.put('memberCount', memberCount);
            response.put('membersAdded', membersToAdd.size());
            response.put('membersRemoved', memberRecordIdsToRemove.size());
            response.put('mobilizationsEvaluated', mobilizationsEvaluated);
            response.put('mobilizationAssignmentsCreated', mobilizationAssignmentsCreated);
            return response;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'saveCrew', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error saving Crew : ' + e.getMessage(), 'apiResponse' => null});
            response.put('message', 'Error: ' + e.getMessage());
            return response;
        }
    }

    @AuraEnabled
    public static String deleteProcess(String processId) {
        try {
            
            if (processId != null) {
                delete as user (new Process__c(Id = processId));
                return 'Success';
            } else {
                return 'Process not found';
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'deleteProcess', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error deleting Process : ' + e.getMessage(), 'apiResponse' => null});
            return 'Error: ' + e.getMessage();
        }
    }

    @AuraEnabled
    public static Process__c upsertProcess(Process__c processRecord) {
        try {
            if (processRecord != null) {
                upsert as user processRecord;
                return processRecord;
            } else {
                throw new AuraHandledException('Process record is null');
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'upsertProcess', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error upserting Process : ' + e.getMessage(), 'apiResponse' => null});
            throw new AuraHandledException('Error saving process: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static Map<String, Object> getCrewContacts(Id crewId) {
        List<CrewContactDTO> assignedContacts = new List<CrewContactDTO>();
        List<CrewContactDTO> availableContacts = new List<CrewContactDTO>();

        Map<String, Object> response = new Map<String, Object>{
            'assignedContacts' => assignedContacts,
            'availableContacts' => availableContacts
        };

        try {
            List<Contact> crewCandidates = [
                SELECT Id, Name,
                    (SELECT Id, Crew__c, Crew__r.Name, Crew__r.Color_Code__c
                     FROM Crew_Members__r)
                FROM Contact
                WHERE RecordType.DeveloperName = 'Employee_WF_Recon'
                AND User__r.IsActive = true
                WITH USER_MODE
                ORDER BY Name
            ];

            for (Contact contactRecord : crewCandidates) {
                CrewContactDTO contactDto = new CrewContactDTO();
                contactDto.id = contactRecord.Id;
                contactDto.name = contactRecord.Name;
                contactDto.isAssignedElsewhere = false;
                contactDto.isAssignedToCurrentCrew = false;

                if (contactRecord.Crew_Members__r != null && !contactRecord.Crew_Members__r.isEmpty()) {
                    List<String> crewNames = new List<String>();

                    for (Crew_Member__c member : contactRecord.Crew_Members__r) {
                        CrewMemberDTO memberDto = new CrewMemberDTO();
                        memberDto.memberId = member.Id;
                        memberDto.crewId = member.Crew__c;
                        memberDto.crewName = member.Crew__r != null ? member.Crew__r.Name : null;
                        memberDto.colorCode = member.Crew__r != null ? member.Crew__r.Color_Code__c : null;
                        contactDto.members.add(memberDto);

                        if (!String.isBlank(memberDto.crewName)) {
                            crewNames.add(memberDto.crewName);
                        }

                        if (crewId != null && member.Crew__c == crewId) {
                            contactDto.isAssignedToCurrentCrew = true;
                            contactDto.currentCrewMemberId = member.Id;
                        } else if (member.Crew__c != null) {
                            contactDto.isAssignedElsewhere = true;
                        }

                        if (String.isBlank(contactDto.primaryCrewColor) && !String.isBlank(memberDto.colorCode)) {
                            contactDto.primaryCrewColor = memberDto.colorCode;
                        }
                    }

                    contactDto.assignedCrewNames = crewNames.isEmpty() ? null : String.join(crewNames, ', ');
                }

                if (contactDto.isAssignedToCurrentCrew) {
                    assignedContacts.add(contactDto);
                } else {
                    availableContacts.add(contactDto);
                }
            }

            availableContacts.sort();
            assignedContacts.sort();
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getCrewContacts', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error fetching crew contacts : ' + e.getMessage(), 'apiResponse' => null});
        }

        return response;
    }

    @AuraEnabled
    public static String deleteCrew(String crewId) {
        try {
            if (crewId != null) {
                delete as user (new Crew__c(Id = crewId));  
                return 'Success';
            } else {
                return 'Crew not found';
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'deleteCrew', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error deleting Crew : ' + e.getMessage(), 'apiResponse' => null});
            return 'Error: ' + e.getMessage();
        }
    }

    @AuraEnabled
    public static List<Cost_Code__c> getCostCodes() {
        List<Cost_Code__c> costCodes = new List<Cost_Code__c>();
        
        try {
            costCodes = [
                SELECT Id, Name, Classification_Type__c, Code__c, Level_Code__c
                FROM Cost_Code__c
                WITH USER_MODE
                ORDER BY CreatedDate DESC
            ];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getCostCodes', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error fetching Cost Codes : ' + e.getMessage(), 'apiResponse' => null});
        }

        return costCodes;
    }

    @AuraEnabled
    public static String deleteCostCode(String costCodeId) {
        try {
            if (costCodeId != null) {
                delete as user (new Cost_Code__c(Id = costCodeId));
                return 'Success';
            } else {
                return 'Cost Code not found';
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'deleteCostCode', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error deleting Cost Code : ' + e.getMessage(), 'apiResponse' => null});
            return 'Error: ' + e.getMessage();
        }
    }

    @AuraEnabled
    public static Cost_Code__c upsertCostCode(Cost_Code__c costCodeRecord) {
        try {
            if (costCodeRecord != null) {
                upsert as user costCodeRecord;
                return costCodeRecord;
            } else {
                throw new AuraHandledException('Cost Code record is null');
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'upsertCostCode', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error upserting Cost Code : ' + e.getMessage(), 'apiResponse' => null});
            throw new AuraHandledException('Error saving cost code: ' + e.getMessage());
        }
    }

    private class MobilizationPropagationResult {
        public Integer mobilizationsEvaluated = 0;
        public Integer assignmentsCreated = 0;
    }

    private static MobilizationPropagationResult handleMobilizationPropagation(Id crewId, Set<Id> contactIdsToInsert) {
        MobilizationPropagationResult result = new MobilizationPropagationResult();

        if (crewId == null || contactIdsToInsert == null || contactIdsToInsert.isEmpty()) {
            return result;
        }

        Date today = Date.today();
        List<Mobilization_Member__c> crewMobilizations = [
            SELECT Mobilization__c
            FROM Mobilization_Member__c
            WHERE Crew__c = :crewId
            AND Mobilization__r.Start_Date__c >= :today
            AND Mobilization__c != null
            WITH USER_MODE
        ];

        Set<Id> mobilizationIds = new Set<Id>();
        for (Mobilization_Member__c crewMob : crewMobilizations) {
            if (crewMob.Mobilization__c != null) {
                mobilizationIds.add(crewMob.Mobilization__c);
            }
        }

        result.mobilizationsEvaluated = mobilizationIds.size();

        if (mobilizationIds.isEmpty()) {
            return result;
        }

        Map<Id, Set<Id>> existingAssignments = new Map<Id, Set<Id>>();
        for (Mobilization_Member__c existingAssignment : [
            SELECT Mobilization__c, Contact__c
            FROM Mobilization_Member__c
            WHERE Mobilization__c IN :mobilizationIds
            AND Contact__c IN :contactIdsToInsert
            WITH USER_MODE
        ]) {
            if (existingAssignment.Mobilization__c == null || existingAssignment.Contact__c == null) {
                continue;
            }

            if (!existingAssignments.containsKey(existingAssignment.Mobilization__c)) {
                existingAssignments.put(existingAssignment.Mobilization__c, new Set<Id>());
            }
            existingAssignments.get(existingAssignment.Mobilization__c).add(existingAssignment.Contact__c);
        }

        List<Mobilization_Member__c> mobilizationInserts = new List<Mobilization_Member__c>();
        for (Id mobilizationId : mobilizationIds) {
            Set<Id> alreadyAssigned = existingAssignments.containsKey(mobilizationId)
                ? existingAssignments.get(mobilizationId)
                : new Set<Id>();

            for (Id contactId : contactIdsToInsert) {
                if (contactId == null || (alreadyAssigned != null && alreadyAssigned.contains(contactId))) {
                    continue;
                }

                mobilizationInserts.add(new Mobilization_Member__c(
                    Mobilization__c = mobilizationId,
                    Contact__c = contactId,
                    Crew__c = crewId
                ));
            }
        }

        if (mobilizationInserts.isEmpty()) {
            return result;
        }

        insert as user mobilizationInserts;
        result.assignmentsCreated = mobilizationInserts.size();

        return result;
    }


    @AuraEnabled
    public static List<String> getMobilizationPicklistValues() {
        Schema.DescribeFieldResult fieldResult = Mobilization__c.Mobilization_Status__c.getDescribe();
        List<String> picklistValues = new List<String>();
        for (Schema.PicklistEntry entry : fieldResult.getPicklistValues()) {
            if (entry.isActive()) {
                picklistValues.add(entry.getValue());
            }
        }
        return picklistValues;
    }

    @AuraEnabled
    public static String updateGlobalPicklistValues(List<String> valuesToAdd, List<String> valuesToDeactivate) {
        if ((valuesToAdd == null || valuesToAdd.isEmpty()) && (valuesToDeactivate == null || valuesToDeactivate.isEmpty())) {
            return 'Error: No values provided to add or deactivate.';
        }

        try {
            // Create Metadata API service instance
            MetadataService.MetadataPort service = MetadataUtil.createService();

            // Read the Global Value Set
            MetadataService.GlobalValueSet globalValueSet =
                (MetadataService.GlobalValueSet) service
                    .readMetadata('GlobalValueSet', new List<String>{ 'wfrecon__Mobilization_Status' })
                    .getRecords()[0];

            if (globalValueSet == null){
                return 'Error: Global Value Set not found.';
            }

            // Get the list of custom values
            List<MetadataService.CustomValue> existingValues = globalValueSet.customValue;

            if (existingValues == null) {
                existingValues = new List<MetadataService.CustomValue>();
            }

            // 🟢 Add new values OR reactivate existing ones
            for (String newValue : valuesToAdd) {
                
                // ✅ CHANGED: We use this flag to check if we found it at all.
                Boolean valueFound = false; 

                for (MetadataService.CustomValue cv : existingValues) {
                    if (cv.fullName == newValue) {
                        valueFound = true; // Mark as found

                        // ✅ CHANGED: If it's inactive, reactivate it.
                        if (!cv.isActive) {
                            cv.isActive = true; 
                        }
                        break; // Found it, no need to keep looping
                    }
                }

                // ✅ CHANGED: Only add a new value if it was *never* found.
                if (!valueFound && String.isNotBlank(newValue)) {
                    MetadataService.CustomValue newPickVal = new MetadataService.CustomValue();
                    newPickVal.fullName = newValue;
                    newPickVal.label = newValue;
                    newPickVal.default_x = false;
                    newPickVal.isActive = true;
                    existingValues.add(newPickVal);
                }
            }

            // 🔴 Deactivate values (This logic was already correct)
            for (String valToDeactivate : valuesToDeactivate) {
                for (MetadataService.CustomValue cv : existingValues) {
                    if (cv.fullName == valToDeactivate) {
                        cv.isActive = false;
                        break;
                    }
                }
            }

            // Assign the modified list back
            globalValueSet.customValue = existingValues;

            // 🧩 Update Metadata
            service.updateMetadata(
                new MetadataService.Metadata[]{ globalValueSet }
            );

            return 'SUCCESS';
        } catch (Exception e) {
            return 'Error: ' + e.getMessage();
        }
    }

    @AuraEnabled
    public static List<StatusColorWrapper> getMobilizationStatusColors() {
        List<StatusColorWrapper> statusColorList = new List<StatusColorWrapper>();
        
        try {
            // Get all custom setting records
            Map<String, Mobilization_Status_Color__c> customSettingsMap = Mobilization_Status_Color__c.getAll();
            
            // Get picklist values from Mobilization__c.Mobilization_Status__c field
            Schema.DescribeFieldResult fieldResult = Mobilization__c.Mobilization_Status__c.getDescribe();
            List<Schema.PicklistEntry> picklistValues = fieldResult.getPicklistValues();
            
            for (Schema.PicklistEntry entry : picklistValues) {
                if (entry.isActive()) {
                    StatusColorWrapper wrapper = createStatusColorWrapper(entry, customSettingsMap);
                    statusColorList.add(wrapper);
                }
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME, 
                'methodName' => 'getMobilizationStatusColors', 
                'isApiException' => false, 
                'statusCode' => null, 
                'exceptionObj' => e,
                'moreDetails' => 'Error fetching mobilization status colors: ' + e.getMessage(), 
                'apiResponse' => null
            });
            throw new AuraHandledException('Error fetching mobilization status colors: ' + e.getMessage());
        }
        
        return statusColorList;
    }
    
    private static StatusColorWrapper createStatusColorWrapper(Schema.PicklistEntry entry, Map<String, Mobilization_Status_Color__c> customSettingsMap) {
        StatusColorWrapper wrapper = new StatusColorWrapper();
        wrapper.picklistValue = entry.getLabel();
        wrapper.apiValue = entry.getValue();
        
        // Check if custom setting exists for this picklist value
        // Try both the label and API value as keys
        Mobilization_Status_Color__c customSetting = null;
        if (customSettingsMap.containsKey(entry.getLabel())) {
            customSetting = customSettingsMap.get(entry.getLabel());
        } else if (customSettingsMap.containsKey(entry.getValue())) {
            customSetting = customSettingsMap.get(entry.getValue());
        }
        
        if (customSetting != null) {
            wrapper.id = customSetting.Id;
            wrapper.textColor = customSetting.wfrecon__Color__c != null ? customSetting.wfrecon__Color__c : '#000000';
            wrapper.backgroundColor = customSetting.wfrecon__Background_Color__c != null ? customSetting.wfrecon__Background_Color__c : '#c4c4c4';
            wrapper.hasCustomSetting = true;
        } else {
            // Default colors if no custom setting exists
            wrapper.id = null;
            wrapper.textColor = '#000000';
            wrapper.backgroundColor = '#c4c4c4';
            wrapper.hasCustomSetting = false;
        }
        
        return wrapper;
    }
    
    
    @AuraEnabled
    public static Map<String, Object> saveStatusColors(List<Mobilization_Status_Color__c> recordsToSave) {
        Map<String, Object> response = new Map<String, Object>{
            'status' => 'ERROR',
            'message' => 'Unable to save status colors.'
        };

        try {
            if (recordsToSave == null || recordsToSave.isEmpty()) {
                response.put('message', 'No records provided to save.');
                return response;
            }

            System.debug('Records received for upsert: ' + JSON.serializePretty(recordsToSave));

            // Perform upsert using Name as key (required for Custom Setting)
            upsert recordsToSave Mobilization_Status_Color__c.Name;

            response.put('status', 'SUCCESS');
            response.put('message', 'Status colors saved successfully.');
            response.put('recordsProcessed', recordsToSave.size());
        } catch (Exception e) {
            System.debug('Error saving status colors: ' + e.getMessage());
            response.put('message', 'Error saving status colors: ' + e.getMessage());
        }

        return response;
    }

    
    public class StatusColorWrapper {
        @AuraEnabled public String id;
        @AuraEnabled public String picklistValue;
        @AuraEnabled public String apiValue;
        @AuraEnabled public String textColor;
        @AuraEnabled public String backgroundColor;
        @AuraEnabled public Boolean hasCustomSetting;
        @AuraEnabled public Boolean isModified;
        
        public StatusColorWrapper() {
            this.isModified = false;
        }
    }

    public class CrewMemberDTO {
        @AuraEnabled public Id memberId;
        @AuraEnabled public Id crewId;
        @AuraEnabled public String crewName;
        @AuraEnabled public String colorCode;
    }

    public class CrewContactDTO implements Comparable {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public Boolean isAssignedElsewhere;
        @AuraEnabled public Boolean isAssignedToCurrentCrew;
        @AuraEnabled public String assignedCrewNames;
        @AuraEnabled public String primaryCrewColor;
        @AuraEnabled public Id currentCrewMemberId;
        @AuraEnabled public List<CrewMemberDTO> members = new List<CrewMemberDTO>();

        public Integer compareTo(Object obj) {
            CrewContactDTO other = (CrewContactDTO)obj;
            Boolean thisAssignedElsewhere = this.isAssignedElsewhere == null ? false : this.isAssignedElsewhere;
            Boolean otherAssignedElsewhere = other.isAssignedElsewhere == null ? false : other.isAssignedElsewhere;

            if (thisAssignedElsewhere != otherAssignedElsewhere) {
                return thisAssignedElsewhere ? 1 : -1;
            }

            String thisName = this.name == null ? '' : this.name.toLowerCase();
            String otherName = other.name == null ? '' : other.name.toLowerCase();
            return thisName.compareTo(otherName);
        }
    }
}