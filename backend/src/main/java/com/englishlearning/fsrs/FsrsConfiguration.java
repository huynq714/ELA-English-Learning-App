package com.englishlearning.fsrs;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FsrsConfiguration {
    @Bean
    FsrsEngine fsrsEngine() {
        return new FsrsEngine();
    }
}
