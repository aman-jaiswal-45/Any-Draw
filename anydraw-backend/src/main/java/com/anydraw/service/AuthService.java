package com.anydraw.service;

import com.anydraw.config.JwtService;
import com.anydraw.dto.SigninRequest;
import com.anydraw.dto.SignupRequest;
import com.anydraw.model.User;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Service
public class AuthService {

    private final UserService userService;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserService userService, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userService = userService;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public Map<String, Object> signup(SignupRequest request) throws Exception {
        if (userService.existsByEmail(request.getUsername())) {
            throw new IllegalArgumentException("User already exists with this email");
        }

        User user = User.builder()
                .email(request.getUsername())
                .password(passwordEncoder.encode(request.getPassword()))
                .name(request.getName())
                .build();

        User savedUser = userService.saveUser(user);

        Map<String, Object> result = new HashMap<>();
        result.put("message", "User created successfully");
        result.put("userId", savedUser.getId());
        return result;
    }

    public Optional<String> signin(SigninRequest request) {
        return userService.getUserByEmail(request.getUsername())
                .filter(user -> passwordEncoder.matches(request.getPassword(), user.getPassword()))
                .map(user -> jwtService.generateToken(user.getId()));
    }
}
