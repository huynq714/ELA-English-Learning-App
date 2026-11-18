package com.englishlearning.profile.dto;

import com.fasterxml.jackson.annotation.JsonSetter;
import jakarta.validation.constraints.Size;

public class CurrentProfilePatchRequest extends ProfilePatchRequest {
    @Size(max = 100, message = "displayName must be at most 100 characters")
    private String displayName;
    private boolean displayNameProvided;

    @JsonSetter("displayName")
    public void setDisplayName(String displayName) {
        this.displayNameProvided = true;
        this.displayName = displayName;
    }

    public String getDisplayName() { return displayName; }
    public boolean isDisplayNameProvided() { return displayNameProvided; }

    @Override
    public boolean hasChanges() {
        return displayNameProvided || super.hasChanges();
    }
}
