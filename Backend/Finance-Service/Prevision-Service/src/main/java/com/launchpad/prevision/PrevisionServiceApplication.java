package com.launchpad.prevision;


import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;

@SpringBootApplication
@EnableFeignClients
public class PrevisionServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(PrevisionServiceApplication.class, args);
    }
}
